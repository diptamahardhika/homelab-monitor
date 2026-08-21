package monitor

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestRefreshAsyncDoesNotBlockWhileRefreshInFlight(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	finished := make(chan struct{})
	var calls atomic.Int32
	cache := NewSnapshotCache(10*time.Second, func(context.Context) (string, error) {
		if calls.Add(1) == 1 {
			close(started)
			<-release
			defer close(finished)
		}
		return "ready", nil
	})

	cache.RefreshAsync(context.Background())

	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("background refresh never started")
	}

	begin := time.Now()
	returned := make(chan struct{})
	go func() {
		cache.RefreshAsync(context.Background())
		close(returned)
	}()
	select {
	case <-returned:
		if elapsed := time.Since(begin); elapsed > 500*time.Millisecond {
			t.Fatalf("RefreshAsync blocked for %v while a refresh was in flight; want immediate return", elapsed)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("RefreshAsync blocked while a refresh was in flight; want immediate return")
	}

	close(release)
	select {
	case <-finished:
	case <-time.After(2 * time.Second):
		t.Fatal("background refresh never completed")
	}
	if got, ok := cache.Snapshot(); !ok || got != "ready" {
		t.Fatalf("Snapshot = (%q, %v); want (ready, true)", got, ok)
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("refresh calls = %d; want 1 (in-flight refresh must not be duplicated)", got)
	}
}

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
