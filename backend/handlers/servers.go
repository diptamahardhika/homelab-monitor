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
