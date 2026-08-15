package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/diptamahardhika/homelab-monitor/backend/config"
	"github.com/diptamahardhika/homelab-monitor/backend/monitor"
	"github.com/go-chi/chi/v5"
)

const (
	defaultRefreshInterval  = 10 * time.Second
	defaultCheckConcurrency = 6
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
	dataPath      string
	cache         *monitor.SnapshotCache[Overview]
}

func New(cfg *config.Config, dataPath string) *Handler {
	h := &Handler{cfg: cfg, dataPath: dataPath}
	h.loadExtraServices()
	h.cache = monitor.NewSnapshotCache(defaultRefreshInterval, h.collectOverview)
	return h
}

// Start begins background monitoring. Requests only read the latest snapshot.
func (h *Handler) Start(ctx context.Context) {
	h.cache.Start(ctx)
}

func (h *Handler) collectOverview(ctx context.Context) (Overview, error) {
	h.mu.RLock()
	services := make([]config.Service, 0, len(h.cfg.Services)+len(h.extraServices))
	services = append(services, h.cfg.Services...)
	services = append(services, h.extraServices...)
	h.mu.RUnlock()

	overview := Overview{
		Servers:  make([]monitor.ServerStatus, len(h.cfg.Servers)),
		Services: make([]monitor.ServiceStatus, len(services)),
	}
	tasks := make([]func(context.Context) error, 0, len(h.cfg.Servers)+len(services)+2)
	for i, server := range h.cfg.Servers {
		i, server := i, server
		tasks = append(tasks, func(ctx context.Context) error {
			dialHost := ""
			if server.Gateway == "docker" {
				dialHost = monitor.GetDockerGatewayIP(ctx)
			}
			overview.Servers[i] = monitor.CheckServer(ctx, server, dialHost)
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
	return overview, nil
}

func (h *Handler) currentOverview(ctx context.Context) Overview {
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

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	overview := h.currentOverview(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview)
}

func (h *Handler) Servers(w http.ResponseWriter, r *http.Request) {
	overview := h.currentOverview(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview.Servers)
}

func (h *Handler) Services(w http.ResponseWriter, r *http.Request) {
	overview := h.currentOverview(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview.Services)
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

	jsonError(w, "service not found", http.StatusNotFound)
}

func (h *Handler) DockerContainers(w http.ResponseWriter, r *http.Request) {
	overview := h.currentOverview(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview.Containers)
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
	overview := h.currentOverview(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview.System)
}
