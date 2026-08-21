package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/pradiptamahardika/homelab-monitor/config"
	"github.com/pradiptamahardika/homelab-monitor/monitor"
)

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
