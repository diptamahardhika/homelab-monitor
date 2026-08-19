package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/pradiptamahardika/homelab-monitor/monitor"
)

// sseMessage is the payload pushed to every connected client on each refresh.
type sseMessage struct {
	Overview Overview                        `json:"overview"`
	History  map[string]monitor.HistoryStats `json:"history"`
}

// sseHub fans out snapshots to connected EventSource clients. Broadcasts are
// non-blocking: a slow client whose buffer is full simply misses that update.
type sseHub struct {
	mu      sync.Mutex
	clients map[chan []byte]struct{}
}

func newSSEHub() *sseHub {
	return &sseHub{clients: make(map[chan []byte]struct{})}
}

func (h *sseHub) subscribe() chan []byte {
	ch := make(chan []byte, 4)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *sseHub) unsubscribe(ch chan []byte) {
	h.mu.Lock()
	delete(h.clients, ch)
	h.mu.Unlock()
}

func (h *sseHub) broadcast(payload []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		select {
		case ch <- payload:
		default:
		}
	}
}

// pushSnapshot is registered as the cache update hook and broadcasts the fresh
// snapshot (plus derived history stats) to all SSE subscribers.
func (h *Handler) pushSnapshot(overview Overview) {
	if data := h.marshalSnapshot(overview); data != nil {
		h.sse.broadcast(data)
	}
}

func (h *Handler) marshalSnapshot(overview Overview) []byte {
	data, err := json.Marshal(sseMessage{Overview: overview, History: h.history.All()})
	if err != nil {
		return nil
	}
	return data
}

// Events streams an SSE feed of overview + history updates. It pushes the
// latest snapshot immediately so the first paint never waits for the next
// refresh, then emits on every cache update.
func (h *Handler) Events(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := h.sse.subscribe()
	defer h.sse.unsubscribe(ch)

	// First event right away.
	if overview, ok := h.cache.Snapshot(); ok {
		if data := h.marshalSnapshot(overview); data != nil {
			h.writeSSE(w, flusher, data)
		}
	}

	keepAlive := time.NewTicker(15 * time.Second)
	defer keepAlive.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepAlive.C:
			_, _ = fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()
		case data := <-ch:
			h.writeSSE(w, flusher, data)
		}
	}
}

func (h *Handler) writeSSE(w http.ResponseWriter, flusher http.Flusher, data []byte) {
	_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()
}