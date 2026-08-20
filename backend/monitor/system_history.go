package monitor

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"time"
)

const (
	defaultSystemSamples  = 10080 // 7 days at 60s sampling
	defaultSystemInterval = time.Minute
)

// SystemSample is one snapshot of host resource usage.
type SystemSample struct {
	Ts                int64   `json:"ts"`
	CPUUsagePercent   float64 `json:"cpu"`
	MemoryUsedPercent float64 `json:"memory_used_percent"`
	DiskUsedPercent   float64 `json:"disk_used_percent"`
}

// SystemStore keeps a rolling series of host resource samples and persists
// them to disk so trend charts survive restarts. Sampling is throttled to
// minInterval (same pattern as HistoryStore).
type SystemStore struct {
	mu         sync.Mutex
	samples    []SystemSample
	path       string
	maxSamples int
	minInterval time.Duration

	lastSaveMu sync.Mutex
	lastSave   time.Time
}

func NewSystemStore(path string, maxSamples int, minInterval time.Duration) *SystemStore {
	if maxSamples <= 0 {
		maxSamples = defaultSystemSamples
	}
	if minInterval <= 0 {
		minInterval = defaultSystemInterval
	}
	ss := &SystemStore{
		path:       path,
		maxSamples: maxSamples,
		minInterval: minInterval,
	}
	ss.load()
	return ss
}

// Start saves the store to disk periodically until ctx ends.
func (ss *SystemStore) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				ss.Save()
				return
			case <-ticker.C:
				ss.Save()
			}
		}
	}()
}

func (ss *SystemStore) load() {
	data, err := os.ReadFile(ss.path)
	if err != nil {
		return // no file yet; start empty
	}
	_ = json.Unmarshal(data, &ss.samples)
}

// Save writes the store to disk (best-effort; errors are ignored).
func (ss *SystemStore) Save() {
	ss.mu.Lock()
	samples := ss.samples
	ss.mu.Unlock()

	out, err := json.MarshalIndent(samples, "", "  ")
	if err != nil {
		return
	}
	tmp := ss.path + ".tmp"
	if err := os.WriteFile(tmp, out, 0644); err != nil {
		return
	}
	_ = os.Rename(tmp, ss.path)
}

// Record adds one resource snapshot, throttled to minInterval.
func (ss *SystemStore) Record(s *SystemStats, ts time.Time) {
	if s == nil {
		return
	}
	ss.mu.Lock()
	if n := len(ss.samples); n > 0 && ts.Unix()-ss.samples[n-1].Ts < int64(ss.minInterval.Seconds()) {
		ss.mu.Unlock()
		return
	}
	ss.samples = append(ss.samples, SystemSample{
		Ts:                ts.Unix(),
		CPUUsagePercent:   s.CPUUsagePercent,
		MemoryUsedPercent: s.MemoryUsedPercent,
		DiskUsedPercent:   s.DiskUsedPercent,
	})
	if len(ss.samples) > ss.maxSamples {
		ss.samples = ss.samples[len(ss.samples)-ss.maxSamples:]
	}
	ss.mu.Unlock()

	ss.lastSaveMu.Lock()
	due := time.Since(ss.lastSave) > time.Minute
	ss.lastSaveMu.Unlock()
	if due {
		ss.Save()
		ss.lastSaveMu.Lock()
		ss.lastSave = time.Now()
		ss.lastSaveMu.Unlock()
	}
}

// Recent returns samples newer than the given number of hours (bounded by
// retention). The returned slice is a copy safe for the caller to mutate.
func (ss *SystemStore) Recent(hours int) []SystemSample {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	if hours <= 0 || len(ss.samples) == 0 {
		return nil
	}
	cutoff := time.Now().Add(-time.Duration(hours) * time.Hour).Unix()
	start := 0
	for i, s := range ss.samples {
		if s.Ts >= cutoff {
			start = i
			break
		}
	}
	out := make([]SystemSample, len(ss.samples)-start)
	copy(out, ss.samples[start:])
	return out
}