package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pradiptamahardika/homelab-monitor/config"
	"github.com/pradiptamahardika/homelab-monitor/dependencies"
	"github.com/pradiptamahardika/homelab-monitor/monitor"
)

const (
	defaultRefreshInterval  = 3 * time.Second
	defaultCheckConcurrency = 16
)

// refreshIntervalFromEnv reads REFRESH_INTERVAL (e.g. "1s", "500ms").
// Unparsable or out-of-range values fall back to the 3s default; the floor
// keeps the check loop from hammering remote hosts and the ceiling prevents
// effectively disabling live refresh.
func refreshIntervalFromEnv() time.Duration {
	raw := strings.TrimSpace(os.Getenv("REFRESH_INTERVAL"))
	if raw == "" {
		return defaultRefreshInterval
	}
	d, err := time.ParseDuration(raw)
	if err != nil {
		return defaultRefreshInterval
	}
	if d < 500*time.Millisecond {
		return 500 * time.Millisecond
	}
	if d > time.Minute {
		return time.Minute
	}
	return d
}

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
	systemHistory *monitor.SystemStore
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
	h.cache = monitor.NewSnapshotCache(refreshIntervalFromEnv(), h.collectOverview)
	h.cache.SetNotify(h.pushSnapshot)

	depsPath := filepath.Join(dataDir, "dependencies.json")
	h.depsStore = dependencies.New(depsPath, func() { h.cache.Invalidate() })

	h.alerts = monitor.NewAlertManager()

	// History stores persist to the data volume so uptime and resource trends
	// survive restarts. Sampling is throttled to ~1/min inside the stores; the
	// live dashboard still refreshes every few seconds.
	h.history = monitor.NewHistoryStore(
		filepath.Join(dataDir, "uptime.json"),
		cfg.HistoryRetentionDays*1440, // 1440 samples/day at 60s
		time.Duration(cfg.HistorySamplingSeconds)*time.Second,
	)
	h.systemHistory = monitor.NewSystemStore(
		filepath.Join(dataDir, "system.json"),
		cfg.SystemHistoryDays*1440,
		time.Duration(cfg.HistorySamplingSeconds)*time.Second,
	)

	return h
}

// Start begins background monitoring. Requests only read the latest snapshot.
func (h *Handler) Start(ctx context.Context) {
	h.cache.Start(ctx)
	h.history.Start(ctx)
	h.systemHistory.Start(ctx)
	// Container stats refresh on their own cadence so the overview cycle
	// never waits on Docker's ~1s streaming stats calls.
	monitor.StartContainerStatsCollector(ctx, h.cache.Interval())
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
	h.systemHistory.Record(overview.System, now)
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

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
