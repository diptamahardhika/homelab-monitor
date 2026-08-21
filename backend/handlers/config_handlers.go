package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/pradiptamahardika/homelab-monitor/config"
)

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
