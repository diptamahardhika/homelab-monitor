package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/pradiptamahardika/homelab-monitor/config"
	"github.com/pradiptamahardika/homelab-monitor/monitor"
)

type Handler struct {
	cfg           *config.Config
	mu            sync.RWMutex
	extraServices []config.Service
	dataPath      string
}

func New(cfg *config.Config, dataPath string) *Handler {
	h := &Handler{cfg: cfg, dataPath: dataPath}
	h.loadExtraServices()
	return h
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

func (h *Handler) Servers(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	results := make([]monitor.ServerStatus, len(h.cfg.Servers))
	for i, s := range h.cfg.Servers {
		results[i] = monitor.CheckServer(ctx, s.Name, s.Host, s.Port, s.Type)
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
		results[i] = monitor.CheckService(ctx, s.Name, s.URL, s.Type)
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
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
			return
		}
	}

	jsonError(w, "service not found", http.StatusNotFound)
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
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	stats := monitor.GetSystemStats(ctx)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
