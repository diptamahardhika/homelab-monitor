package monitor

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"time"
)

const defaultHistorySamples = 1000 // ~50 min at 3s interval

// HistorySample is one up/down observation at a point in time.
type HistorySample struct {
	Ts int64 `json:"ts"`
	Up bool  `json:"up"`
}

// HistoryEntry holds the rolling window of samples for one target.
type HistoryEntry struct {
	Samples []HistorySample `json:"samples"`
}

// HistoryStats is the derived summary exposed via the API.
type HistoryStats struct {
	UptimePercent float64 `json:"uptime_percent"`
	LastDown      string  `json:"last_down"` // RFC3339, empty if never down in window
	Total         int     `json:"samples"`
	Up            int     `json:"up_samples"`
	State         string  `json:"state"` // "up" | "down" | "unknown"
}

// HistoryStore keeps a rolling in-memory window per target and persists it
// to disk so uptime survives restarts.
type HistoryStore struct {
	mu         sync.Mutex
	data       map[string]*HistoryEntry
	path       string
	maxSamples int

	lastSaveMu sync.Mutex
	lastSave   time.Time
}

func NewHistoryStore(path string, maxSamples int) *HistoryStore {
	if maxSamples <= 0 {
		maxSamples = defaultHistorySamples
	}
	hs := &HistoryStore{
		data:       map[string]*HistoryEntry{},
		path:       path,
		maxSamples: maxSamples,
	}
	hs.load()
	return hs
}

// Start saves the store to disk periodically until ctx ends.
func (hs *HistoryStore) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				hs.Save()
				return
			case <-ticker.C:
				hs.Save()
			}
		}
	}()
}

func (hs *HistoryStore) load() {
	data, err := os.ReadFile(hs.path)
	if err != nil {
		return // no file yet; start empty
	}
	_ = json.Unmarshal(data, &hs.data)
}

// Save writes the store to disk (best-effort; errors are logged).
func (hs *HistoryStore) Save() {
	hs.mu.Lock()
	data := hs.data
	hs.mu.Unlock()

	out, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return
	}
	// write to temp then rename for atomicity
	tmp := hs.path + ".tmp"
	if err := os.WriteFile(tmp, out, 0644); err != nil {
		return
	}
	_ = os.Rename(tmp, hs.path)
}

// Record adds one observation for the given key.
func (hs *HistoryStore) Record(key string, up bool, ts time.Time) {
	hs.mu.Lock()
	e, ok := hs.data[key]
	if !ok {
		e = &HistoryEntry{}
		hs.data[key] = e
	}
	e.Samples = append(e.Samples, HistorySample{Ts: ts.Unix(), Up: up})
	if len(e.Samples) > hs.maxSamples {
		e.Samples = e.Samples[len(e.Samples)-hs.maxSamples:]
	}
	hs.mu.Unlock()

	// Throttle disk writes to at most once per minute.
	hs.lastSaveMu.Lock()
	due := time.Since(hs.lastSave) > time.Minute
	hs.lastSaveMu.Unlock()
	if due {
		hs.Save()
		hs.lastSaveMu.Lock()
		hs.lastSave = time.Now()
		hs.lastSaveMu.Unlock()
	}
}

// Stats returns the derived summary for a key.
func (hs *HistoryStore) Stats(key string) HistoryStats {
	hs.mu.Lock()
	e := hs.data[key]
	hs.mu.Unlock()

	if e == nil || len(e.Samples) == 0 {
		return HistoryStats{State: "unknown"}
	}

	total := len(e.Samples)
	upCount := 0
	var lastDown int64
	for _, s := range e.Samples {
		if s.Up {
			upCount++
		} else {
			lastDown = s.Ts
		}
	}

	st := HistoryStats{
		UptimePercent: float64(upCount) / float64(total) * 100,
		Total:         total,
		Up:            upCount,
		State:         "up",
	}
	if !e.Samples[total-1].Up {
		st.State = "down"
	}
	if lastDown > 0 {
		st.LastDown = time.Unix(lastDown, 0).UTC().Format(time.RFC3339)
	}
	return st
}

// All returns stats for every tracked key.
func (hs *HistoryStore) All() map[string]HistoryStats {
	hs.mu.Lock()
	keys := make([]string, 0, len(hs.data))
	for k := range hs.data {
		keys = append(keys, k)
	}
	hs.mu.Unlock()

	out := make(map[string]HistoryStats, len(keys))
	for _, k := range keys {
		out[k] = hs.Stats(k)
	}
	return out
}
