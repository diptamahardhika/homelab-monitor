package monitor

import (
	"path/filepath"
	"testing"
	"time"
)

func TestSystemStoreRecordAndRecent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "system.json")
	ss := NewSystemStore(path, 100, time.Minute)

	base := time.Now().Truncate(time.Minute)
	ss.Record(&SystemStats{CPUUsagePercent: 10, MemoryUsedPercent: 20, DiskUsedPercent: 30}, base)
	ss.Record(&SystemStats{CPUUsagePercent: 15, MemoryUsedPercent: 25, DiskUsedPercent: 35}, base.Add(30*time.Second))  // throttled
	ss.Record(&SystemStats{CPUUsagePercent: 50, MemoryUsedPercent: 40, DiskUsedPercent: 45}, base.Add(90*time.Second)) // kept

	ss.mu.Lock()
	got := len(ss.samples)
	ss.mu.Unlock()
	if got != 2 {
		t.Fatalf("expected 2 samples after throttle, got %d", got)
	}

	recent := ss.Recent(24)
	if len(recent) != 2 {
		t.Fatalf("expected 2 recent samples, got %d", len(recent))
	}
	if recent[len(recent)-1].CPUUsagePercent != 50 {
		t.Fatalf("expected last CPU 50, got %f", recent[len(recent)-1].CPUUsagePercent)
	}
}

func TestSystemStoreMaxSamples(t *testing.T) {
	ss := NewSystemStore(filepath.Join(t.TempDir(), "system.json"), 3, time.Second)

	base := time.Now().Truncate(time.Second)
	for i := 0; i < 10; i++ {
		ss.Record(&SystemStats{CPUUsagePercent: float64(i)}, base.Add(time.Duration(i)*time.Second))
	}

	ss.mu.Lock()
	got := len(ss.samples)
	ss.mu.Unlock()
	if got != 3 {
		t.Fatalf("expected 3 samples after trim, got %d", got)
	}
}

func TestSystemStorePersistRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "system.json")
	ss := NewSystemStore(path, 100, time.Minute)
	base := time.Now().Truncate(time.Minute)
	ss.Record(&SystemStats{CPUUsagePercent: 12, MemoryUsedPercent: 22, DiskUsedPercent: 32}, base)
	ss.Save()

	ss2 := NewSystemStore(path, 100, time.Minute)
	recent := ss2.Recent(24)
	if len(recent) != 1 || recent[0].CPUUsagePercent != 12 {
		t.Fatalf("expected loaded sample with cpu=12, got %+v", recent)
	}
}

func TestSystemStoreRecentWindow(t *testing.T) {
	ss := NewSystemStore(filepath.Join(t.TempDir(), "system.json"), 1000, 0)
	now := time.Now()
	ss.Record(&SystemStats{}, now.Add(-48*time.Hour)) // outside 24h window
	ss.Record(&SystemStats{}, now.Add(-2*time.Hour))  // inside window

	recent := ss.Recent(24)
	if len(recent) != 1 {
		t.Fatalf("expected 1 recent sample within 24h, got %d", len(recent))
	}
}