package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/pradiptamahardika/homelab-monitor/dependencies"
)

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
