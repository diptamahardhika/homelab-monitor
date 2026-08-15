package monitor

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestSnapshotCacheCoalescesConcurrentRefreshes(t *testing.T) {
	var calls atomic.Int32
	cache := NewSnapshotCache(10*time.Second, func(context.Context) (string, error) {
		calls.Add(1)
		time.Sleep(25 * time.Millisecond)
		return "ready", nil
	})

	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := cache.Refresh(context.Background()); err != nil {
				t.Errorf("Refresh returned an error: %v", err)
			}
		}()
	}
	wg.Wait()

	if got := calls.Load(); got != 1 {
		t.Fatalf("refresh calls = %d; want 1", got)
	}
	if got, ok := cache.Snapshot(); !ok || got != "ready" {
		t.Fatalf("Snapshot = (%q, %v); want (ready, true)", got, ok)
	}
}
