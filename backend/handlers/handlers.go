package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/pradiptamahardika/homelab-monitor/config"
	"github.com/pradiptamahardika/homelab-monitor/dependencies"
	"github.com/pradiptamahardika/homelab-monitor/monitor"
)

const (
	defaultRefreshInterval  = 3 * time.Second
	defaultCheckConcurrency = 6
)

// Build info is injected at build time via -ldflags.
var (
	Version    = "dev"
	Commit     = ""
	CommitTime = ""
)

type Overview struct {
	Servers    []monitor.ServerStatus    `json:"servers"`
	Services   []monitor.ServiceStatus   `json:"services"`
	Containers []monitor.DockerContainer `json:"containers"`
	System     *monitor.SystemStats      `json:"system"`
	CheckedAt  string                    `json:"checked_at"`
}

type Handler struct {
	cfg           *config.Config
	mu            sync.RWMutex
	extraServices []config.Service
	extraServers  []config.Server
	dataPath      string
	configPath    string
	cache         *monitor.SnapshotCache[Overview]
	depsStore     *dependencies.Store
	alerts        *monitor.AlertManager
	history       *monitor.HistoryStore
	sse           *sseHub
}

func New(cfg *config.Config, dataPath string) *Handler {
	dataDir := filepath.Dir(dataPath)
	configPath := filepath.Join(dataDir, "config.yaml")

	// A config persisted by the UI overrides the seed config (the one baked into
	// the image or mounted at CONFIG_PATH). Persisting into the data volume keeps
	// edits/deletes across container rebuilds and restarts.
	if persisted, err := config.Load(configPath); err == nil {
		*cfg = *persisted
	}

	h := &Handler{cfg: cfg, dataPath: dataPath, configPath: configPath}
	h.loadExtraServices()
	h.loadExtraServers()
	h.sse = newSSEHub()
	h.cache = monitor.NewSnapshotCache(defaultRefreshInterval, h.collectOverview)
	h.cache.SetNotify(h.pushSnapshot)

	depsPath := filepath.Join(dataDir, "dependencies.json")
	h.depsStore = dependencies.New(depsPath, func() { h.cache.Invalidate() })

	h.alerts = monitor.NewAlertManager()
	h.history = monitor.NewHistoryStore(filepath.Join(dataDir, "uptime.json"), 0) // 0 => default 300 samples

	return h
}

// Start begins background monitoring. Requests only read the latest snapshot.
func (h *Handler) Start(ctx context.Context) {
	h.cache.Start(ctx)
	h.history.Start(ctx)
}

func (h *Handler) collectOverview(ctx context.Context) (Overview, error) {
	h.mu.RLock()
	services := make([]config.Service, 0, len(h.cfg.Services)+len(h.extraServices))
	services = append(services, h.cfg.Services...)
	services = append(services, h.extraServices...)
	servers := make([]config.Server, 0, len(h.cfg.Servers)+len(h.extraServers))
	servers = append(servers, h.cfg.Servers...)
	servers = append(servers, h.extraServers...)
	h.mu.RUnlock()

	overview := Overview{
		Servers:  make([]monitor.ServerStatus, len(servers)),
		Services: make([]monitor.ServiceStatus, len(services)),
	}
	tasks := make([]func(context.Context) error, 0, len(servers)+len(services)+2)

	gatewayIP := ""
	for _, server := range servers {
		if server.Gateway == "docker" {
			gatewayIP = monitor.GetDockerGatewayIP(ctx)
			break
		}
	}

	for i, server := range servers {
		i, server := i, server
		tasks = append(tasks, func(ctx context.Context) error {
			overview.Servers[i] = monitor.CheckServer(ctx, server, gatewayIP)
			return nil
		})
	}
	for i, service := range services {
		i, service := i, service
		tasks = append(tasks, func(ctx context.Context) error {
			overview.Services[i] = monitor.CheckService(ctx, service)
			return nil
		})
	}
	tasks = append(tasks,
		func(ctx context.Context) error {
			containers, _ := monitor.GetDockerContainers(ctx)
			overview.Containers = containers
			return nil
		},
		func(ctx context.Context) error {
			overview.System = monitor.GetSystemStats(ctx)
			return nil
		},
	)
	if err := monitor.RunBounded(ctx, tasks, defaultCheckConcurrency, func(ctx context.Context, task func(context.Context) error) error {
		return task(ctx)
	}); err != nil {
		return Overview{}, err
	}
	overview.CheckedAt = time.Now().UTC().Format(time.RFC3339)

	// Record uptime history and fire alerts on up/down transitions.
	now := time.Now()
	targets := make([]monitor.AlertTarget, 0, len(overview.Servers)+len(overview.Services))
	for i := range overview.Servers {
		s := &overview.Servers[i]
		key := "server:" + s.Name
		h.history.Record(key, s.Alive, now)
		targets = append(targets, monitor.AlertTarget{
			Key: key, Name: s.Name, Kind: "server", Up: s.Alive, Detail: s.Error,
		})
	}
	for i := range overview.Services {
		s := &overview.Services[i]
		up := s.Status == "up"
		key := "service:" + s.Name
		h.history.Record(key, up, now)
		detail := s.Error
		if !up && detail == "" {
			detail = s.Status
		}
		targets = append(targets, monitor.AlertTarget{
			Key: key, Name: s.Name, Kind: "service", Up: up, Detail: detail,
		})
	}
	h.alerts.Process(targets)

	return overview, nil
}

func (h *Handler) currentOverview(ctx context.Context) Overview {
	_ = h.cache.Refresh(ctx)
	overview, _ := h.cache.Snapshot()
	return overview
}

// overviewNow returns the latest snapshot immediately (stale-while-revalidate):
// if a snapshot already exists it is served right away and a refresh is kicked
// off in the background. It only blocks on the very first request, when no data
// has been collected yet.
func (h *Handler) overviewNow(ctx context.Context) Overview {
	if overview, ok := h.cache.Snapshot(); ok {
		h.cache.RefreshAsync(ctx)
		return overview
	}
	_ = h.cache.Refresh(ctx)
	overview, _ := h.cache.Snapshot()
	return overview
}

func (h *Handler) loadExtraServices() {
	data, err := os.ReadFile(h.dataPath)
	if err != nil {
		return
	}
	json.Unmarshal(data, &h.extraServices)
}

func (h *Handler) saveExtraServices() error {
	data, err := json.MarshalIndent(h.extraServices, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(h.dataPath, data, 0644)
}

func (h *Handler) extraServersPath() string {
	return filepath.Join(filepath.Dir(h.dataPath), "extra_servers.json")
}

func (h *Handler) loadExtraServers() {
	data, err := os.ReadFile(h.extraServersPath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &h.extraServers)
}

func (h *Handler) saveExtraServers() error {
	data, err := json.MarshalIndent(h.extraServers, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(h.extraServersPath(), data, 0644)
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) Version(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"version":     Version,
		"commit":      Commit,
		"commit_time": CommitTime,
	})
}

func (h *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	overview := h.overviewNow(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview)
}

func (h *Handler) Servers(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	h.mu.RLock()
	allServers := make([]config.Server, 0, len(h.cfg.Servers)+len(h.extraServers))
	allServers = append(allServers, h.cfg.Servers...)
	allServers = append(allServers, h.extraServers...)
	h.mu.RUnlock()

	results := make([]monitor.ServerStatus, len(allServers))
	gatewayIP := ""
	for _, s := range allServers {
		if s.Gateway == "docker" {
			gatewayIP = monitor.GetDockerGatewayIP(ctx)
			break
		}
	}
	for i, s := range allServers {
		results[i] = monitor.CheckServer(ctx, s, gatewayIP)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (h *Handler) Services(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	h.mu.RLock()
	allSvcs := make([]config.Service, 0, len(h.cfg.Services)+len(h.extraServices))
	allSvcs = append(allSvcs, h.cfg.Services...)
	allSvcs = append(allSvcs, h.extraServices...)
	h.mu.RUnlock()

	results := make([]monitor.ServiceStatus, len(allSvcs))
	for i, s := range allSvcs {
		results[i] = monitor.CheckService(ctx, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func (h *Handler) AddService(w http.ResponseWriter, r *http.Request) {
	var svc config.Service
	if err := json.NewDecoder(r.Body).Decode(&svc); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if svc.Name == "" || svc.URL == "" {
		jsonError(w, "name and url are required", http.StatusBadRequest)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	for _, s := range h.extraServices {
		if s.Name == svc.Name {
			jsonError(w, "service already exists", http.StatusConflict)
			return
		}
	}

	h.extraServices = append(h.extraServices, svc)
	if err := h.saveExtraServices(); err != nil {
		jsonError(w, "failed to persist service", http.StatusInternalServerError)
		return
	}
	h.cache.Invalidate()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "created"})
}

func (h *Handler) UpdateService(w http.ResponseWriter, r *http.Request) {
	oldName := chi.URLParam(r, "name")

	var svc config.Service
	if err := json.NewDecoder(r.Body).Decode(&svc); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if svc.Name == "" || svc.URL == "" {
		jsonError(w, "name and url are required", http.StatusBadRequest)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// update in extraServices (UI-added services)
	for i, s := range h.extraServices {
		if s.Name == oldName {
			for j, other := range h.extraServices {
				if j != i && other.Name == svc.Name {
					jsonError(w, "service already exists", http.StatusConflict)
					return
				}
			}
			h.extraServices[i] = svc
			if err := h.saveExtraServices(); err != nil {
				jsonError(w, "failed to persist service", http.StatusInternalServerError)
				return
			}
			h.cache.Invalidate()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
			return
		}
	}

	// update in config.yaml services
	for i, s := range h.cfg.Services {
		if s.Name == oldName {
			for j, other := range h.cfg.Services {
				if j != i && other.Name == svc.Name {
					jsonError(w, "service already exists", http.StatusConflict)
					return
				}
			}
			h.cfg.Services[i] = svc
			if err := h.cfg.Save(h.configPath); err != nil {
				jsonError(w, "failed to persist config: "+err.Error(), http.StatusInternalServerError)
				return
			}
			h.cache.Invalidate()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
			return
		}
	}

	jsonError(w, "service not found", http.StatusNotFound)
}

func (h *Handler) DeleteService(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	h.mu.Lock()
	defer h.mu.Unlock()

	for i, s := range h.extraServices {
		if s.Name == name {
			h.extraServices = append(h.extraServices[:i], h.extraServices[i+1:]...)
			h.saveExtraServices()
			h.cache.Invalidate()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
			return
		}
	}

	// delete from config.yaml services
	for i, s := range h.cfg.Services {
		if s.Name == name {
			h.cfg.Services = append(h.cfg.Services[:i], h.cfg.Services[i+1:]...)
			if err := h.cfg.Save(h.configPath); err != nil {
				jsonError(w, "failed to persist config: "+err.Error(), http.StatusInternalServerError)
				return
			}
			h.cache.Invalidate()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
			return
		}
	}

	jsonError(w, "service not found", http.StatusNotFound)
}

func (h *Handler) AddServer(w http.ResponseWriter, r *http.Request) {
	var srv config.Server
	if err := json.NewDecoder(r.Body).Decode(&srv); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if srv.Name == "" || srv.Host == "" || srv.Port == 0 {
		jsonError(w, "name, host, and port are required", http.StatusBadRequest)
		return
	}
	if srv.Type == "" {
		srv.Type = "tcp"
	}
	if srv.Type != "tcp" && srv.Type != "http" {
		jsonError(w, "server type must be tcp or http", http.StatusBadRequest)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	for _, s := range h.extraServers {
		if s.Name == srv.Name {
			jsonError(w, "server already exists", http.StatusConflict)
			return
		}
	}

	h.extraServers = append(h.extraServers, srv)
	if err := h.saveExtraServers(); err != nil {
		jsonError(w, "failed to persist server", http.StatusInternalServerError)
		return
	}
	h.cache.Invalidate()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "created"})
}

func (h *Handler) UpdateServer(w http.ResponseWriter, r *http.Request) {
	oldName := chi.URLParam(r, "name")

	var srv config.Server
	if err := json.NewDecoder(r.Body).Decode(&srv); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if srv.Name == "" || srv.Host == "" || srv.Port == 0 {
		jsonError(w, "name, host, and port are required", http.StatusBadRequest)
		return
	}
	if srv.Type == "" {
		srv.Type = "tcp"
	}
	if srv.Type != "tcp" && srv.Type != "http" {
		jsonError(w, "server type must be tcp or http", http.StatusBadRequest)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// update in extraServers (UI-added servers)
	for i, s := range h.extraServers {
		if s.Name == oldName {
			for j, other := range h.extraServers {
				if j != i && other.Name == srv.Name {
					jsonError(w, "server already exists", http.StatusConflict)
					return
				}
			}
			h.extraServers[i] = srv
			if err := h.saveExtraServers(); err != nil {
				jsonError(w, "failed to persist server", http.StatusInternalServerError)
				return
			}
			h.cache.Invalidate()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
			return
		}
	}

	// update in config.yaml servers
	for i, s := range h.cfg.Servers {
		if s.Name == oldName {
			for j, other := range h.cfg.Servers {
				if j != i && other.Name == srv.Name {
					jsonError(w, "server already exists", http.StatusConflict)
					return
				}
			}
			h.cfg.Servers[i] = srv
			if err := h.cfg.Save(h.configPath); err != nil {
				jsonError(w, "failed to persist config: "+err.Error(), http.StatusInternalServerError)
				return
			}
			h.cache.Invalidate()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
			return
		}
	}

	jsonError(w, "server not found", http.StatusNotFound)
}

func (h *Handler) DeleteServer(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	h.mu.Lock()
	defer h.mu.Unlock()

	for i, s := range h.extraServers {
		if s.Name == name {
			h.extraServers = append(h.extraServers[:i], h.extraServers[i+1:]...)
			h.saveExtraServers()
			h.cache.Invalidate()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
			return
		}
	}

	// delete from config.yaml servers
	for i, s := range h.cfg.Servers {
		if s.Name == name {
			h.cfg.Servers = append(h.cfg.Servers[:i], h.cfg.Servers[i+1:]...)
			if err := h.cfg.Save(h.configPath); err != nil {
				jsonError(w, "failed to persist config: "+err.Error(), http.StatusInternalServerError)
				return
			}
			h.cache.Invalidate()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
			return
		}
	}

	jsonError(w, "server not found", http.StatusNotFound)
}

func (h *Handler) DockerContainers(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	containers, err := monitor.GetDockerContainers(ctx)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]struct{}{})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(containers)
}

func (h *Handler) DockerContainerDetail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	detail, err := monitor.GetContainerDetail(ctx, id)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detail)
}

func (h *Handler) System(w http.ResponseWriter, r *http.Request) {
	overview := h.overviewNow(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview.System)
}

func (h *Handler) GetConfig(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.cfg)
}

type ConfigUpdateRequest struct {
	Servers  []config.Server  `json:"servers"`
	Services []config.Service `json:"services"`
	Port     int              `json:"port"`
}

func (h *Handler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	var req ConfigUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// Validate
	for _, s := range req.Servers {
		if s.Name == "" || s.Host == "" || s.Port == 0 {
			jsonError(w, "server name, host, and port are required", http.StatusBadRequest)
			return
		}
		if s.Type != "tcp" && s.Type != "http" {
			jsonError(w, "server type must be tcp or http", http.StatusBadRequest)
			return
		}
	}
	for _, s := range req.Services {
		if s.Name == "" || s.URL == "" {
			jsonError(w, "service name and url are required", http.StatusBadRequest)
			return
		}
		if s.Type != "tcp" && s.Type != "http" {
			jsonError(w, "service type must be tcp or http", http.StatusBadRequest)
			return
		}
	}

	h.cfg.Servers = req.Servers
	h.cfg.Services = req.Services
	if req.Port > 0 {
		h.cfg.Port = req.Port
	}

	// Persist to config.yaml
	if err := h.cfg.Save(h.configPath); err != nil {
		jsonError(w, "failed to persist config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	h.cache.Invalidate()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

// ExportConfig is the full serializable configuration: seed config merged with
// UI-added extras, plus dependencies.
type ExportConfig struct {
	Version      int                       `json:"version"`
	Port         int                       `json:"port"`
	Servers      []config.Server           `json:"servers"`
	Services     []config.Service          `json:"services"`
	Dependencies []dependencies.Dependency `json:"dependencies"`
}

const exportConfigVersion = 1

func (h *Handler) ExportConfig(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	servers := make([]config.Server, 0, len(h.cfg.Servers)+len(h.extraServers))
	servers = append(servers, h.cfg.Servers...)
	servers = append(servers, h.extraServers...)
	services := make([]config.Service, 0, len(h.cfg.Services)+len(h.extraServices))
	services = append(services, h.cfg.Services...)
	services = append(services, h.extraServices...)
	port := h.cfg.Port
	h.mu.RUnlock()

	export := ExportConfig{
		Version:      exportConfigVersion,
		Port:         port,
		Servers:      servers,
		Services:     services,
		Dependencies: h.depsStore.GetAll(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", `attachment; filename="homelab-monitor-config.json"`)
	json.NewEncoder(w).Encode(export)
}

func (h *Handler) ImportConfig(w http.ResponseWriter, r *http.Request) {
	var req ExportConfig
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Version != exportConfigVersion {
		jsonError(w, "unsupported config version", http.StatusBadRequest)
		return
	}

	// Validate servers and services exactly like UpdateConfig.
	for _, s := range req.Servers {
		if s.Name == "" || s.Host == "" || s.Port == 0 {
			jsonError(w, "server name, host, and port are required", http.StatusBadRequest)
			return
		}
		if s.Type != "tcp" && s.Type != "http" {
			jsonError(w, "server type must be tcp or http", http.StatusBadRequest)
			return
		}
	}
	for _, s := range req.Services {
		if s.Name == "" || s.URL == "" {
			jsonError(w, "service name and url are required", http.StatusBadRequest)
			return
		}
		if s.Type != "tcp" && s.Type != "http" {
			jsonError(w, "service type must be tcp or http", http.StatusBadRequest)
			return
		}
	}

	if req.Dependencies == nil {
		req.Dependencies = []dependencies.Dependency{}
	}
	if err := dependencies.Validate(req.Dependencies); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// Replace seed config and persist to config.yaml.
	h.cfg.Servers = req.Servers
	h.cfg.Services = req.Services
	if req.Port > 0 {
		h.cfg.Port = req.Port
	}
	if err := h.cfg.Save(h.configPath); err != nil {
		jsonError(w, "failed to persist config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Clear UI-added extras.
	h.extraServices = []config.Service{}
	h.extraServers = []config.Server{}
	if err := h.saveExtraServices(); err != nil {
		jsonError(w, "failed to persist services: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := h.saveExtraServers(); err != nil {
		jsonError(w, "failed to persist servers: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Replace dependencies (validated above).
	if err := h.depsStore.Replace(req.Dependencies); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.cache.Invalidate()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       "imported",
		"servers":      len(req.Servers),
		"services":     len(req.Services),
		"dependencies": len(req.Dependencies),
	})
}

func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.history.All())
}

func (h *Handler) GetDependencies(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.depsStore.GetAll())
}

type DependencyRequest struct {
	From string `json:"from"`
	To   string `json:"to"`
}

func (h *Handler) AddDependency(w http.ResponseWriter, r *http.Request) {
	var req DependencyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.From == "" || req.To == "" {
		jsonError(w, "from and to are required", http.StatusBadRequest)
		return
	}
	if err := h.depsStore.Add(dependencies.Dependency{From: req.From, To: req.To}); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "created"})
}

func (h *Handler) UpdateDependency(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" || to == "" {
		jsonError(w, "from and to query parameters required", http.StatusBadRequest)
		return
	}

	var req DependencyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.From == "" || req.To == "" {
		jsonError(w, "from and to are required", http.StatusBadRequest)
		return
	}

	if err := h.depsStore.Update(from, to, dependencies.Dependency{From: req.From, To: req.To}); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func (h *Handler) DeleteDependency(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" || to == "" {
		jsonError(w, "from and to query parameters required", http.StatusBadRequest)
		return
	}
	if err := h.depsStore.Remove(from, to); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// ReorderDependencies replaces the full dependency list with the provided
// ordered list, persisting the new order. Used by the frontend drag-and-drop
// table to persist a manual row arrangement.
func (h *Handler) ReorderDependencies(w http.ResponseWriter, r *http.Request) {
	var req []dependencies.Dependency
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.depsStore.Replace(req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "reordered"})
}
