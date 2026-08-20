package monitor

import (
	"path/filepath"
	"testing"
	"time"
)

func TestHistoryStoreThrottle(t *testing.T) {
	hs := NewHistoryStore(filepath.Join(t.TempDir(), "uptime.json"), 10, time.Minute)

	base := time.Now().Truncate(time.Minute)
	hs.Record("service:a", true, base)
	hs.Record("service:a", true, base.Add(30*time.Second))  // too soon, skipped
	hs.Record("service:a", false, base.Add(90*time.Second)) // 90s later, kept

	stats := hs.Stats("service:a")
	if stats.Total != 2 {
		t.Fatalf("expected 2 samples after throttle, got %d", stats.Total)
	}
	if stats.Up != 1 || stats.State != "down" {
		t.Fatalf("expected 1 up + last down, got up=%d state=%s", stats.Up, stats.State)
	}
}

func TestHistoryStoreMaxSamples(t *testing.T) {
	hs := NewHistoryStore(filepath.Join(t.TempDir(), "uptime.json"), 5, time.Second)

	base := time.Now().Truncate(time.Second)
	for i := 0; i < 20; i++ {
		hs.Record("server:x", true, base.Add(time.Duration(i)*time.Second))
	}

	stats := hs.Stats("server:x")
	if stats.Total != 5 {
		t.Fatalf("expected 5 samples after trim, got %d", stats.Total)
	}
	if stats.UptimePercent != 100 {
		t.Fatalf("expected 100%% uptime, got %f", stats.UptimePercent)
	}
}

func TestHistoryStoreDefaultInterval(t *testing.T) {
	hs := NewHistoryStore(filepath.Join(t.TempDir(), "uptime.json"), 10, 0)
	if hs.minInterval != defaultHistoryInterval {
		t.Fatalf("expected default interval %s, got %s", defaultHistoryInterval, hs.minInterval)
	}
}