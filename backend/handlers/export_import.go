package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/pradiptamahardika/homelab-monitor/config"
	"github.com/pradiptamahardika/homelab-monitor/dependencies"
)

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
