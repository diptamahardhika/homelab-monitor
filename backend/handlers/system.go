package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
)

func (h *Handler) System(w http.ResponseWriter, r *http.Request) {
	overview := h.overviewNow(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview.System)
}

func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.history.All())
}

// SystemHistory returns the rolling host resource series (cpu/mem/disk %).
// The window is bounded by ?hours= (default 24, capped at 168 = 7 days).
func (h *Handler) SystemHistory(w http.ResponseWriter, r *http.Request) {
	hours := 24
	if q := r.URL.Query().Get("hours"); q != "" {
		if v, err := strconv.Atoi(q); err == nil && v > 0 {
			hours = v
		}
	}
	if hours > 168 {
		hours = 168
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"samples": h.systemHistory.Recent(hours),
	})
}
