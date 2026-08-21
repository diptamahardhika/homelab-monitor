package monitor

import (
	"context"
	"sync"
	"time"
)

// SnapshotCache stores the latest successful monitoring snapshot and ensures
// only one refresh is executed per interval, even under concurrent requests.
type SnapshotCache[T any] struct {
	interval time.Duration
	refresh  func(context.Context) (T, error)
	notify   func(T)

	mu        sync.RWMutex
	snapshot  T
	hasValue  bool
	updatedAt time.Time
	refreshMu sync.Mutex
	lifecycle context.Context
}

func NewSnapshotCache[T any](interval time.Duration, refresh func(context.Context) (T, error)) *SnapshotCache[T] {
	return &SnapshotCache[T]{interval: interval, refresh: refresh}
}

// SetNotify registers a callback invoked (outside the cache lock) every time a
// refresh produces a fresh snapshot. Used to push updates to SSE subscribers.
func (c *SnapshotCache[T]) SetNotify(fn func(T)) {
	c.mu.Lock()
	c.notify = fn
	c.mu.Unlock()
}

func (c *SnapshotCache[T]) Snapshot() (T, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.snapshot, c.hasValue
}

func (c *SnapshotCache[T]) Invalidate() {
	c.mu.Lock()
	c.updatedAt = time.Time{}
	c.mu.Unlock()
}

func (c *SnapshotCache[T]) isFresh() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.hasValue && time.Since(c.updatedAt) < c.interval
}

// Refresh runs the underlying refresh synchronously, but only if the snapshot
// is missing or stale. Concurrent callers block until the refresh completes so
// only one refresh is executed at a time.
func (c *SnapshotCache[T]) Refresh(ctx context.Context) error {
	c.refreshMu.Lock()
	defer c.refreshMu.Unlock()
	return c.refreshLocked(ctx)
}

// RefreshAsync returns immediately with the current snapshot and kicks off a
// background refresh only when the snapshot is missing or stale. If a refresh
// is already in flight it is not duplicated and the caller never waits on it:
// TryLock keeps this truly non-blocking, so slow probes (e.g. unreachable
// hosts burning their full timeout) can never stall API responses.
func (c *SnapshotCache[T]) RefreshAsync(ctx context.Context) {
	if !c.refreshMu.TryLock() {
		return
	}
	if c.isFresh() {
		c.refreshMu.Unlock()
		return
	}
	bg := ctx
	if c.lifecycle != nil {
		bg = c.lifecycle
	}
	go func() {
		defer c.refreshMu.Unlock()
		_ = c.refreshLocked(bg)
	}()
}

func (c *SnapshotCache[T]) refreshLocked(ctx context.Context) error {
	if c.isFresh() {
		return nil
	}

	snapshot, err := c.refresh(ctx)
	if err != nil {
		return err
	}

	c.mu.Lock()
	c.snapshot = snapshot
	c.hasValue = true
	c.updatedAt = time.Now()
	notify := c.notify
	c.mu.Unlock()

	if notify != nil {
		notify(snapshot)
	}
	return nil
}

// Start refreshes the snapshot immediately, then on interval until ctx ends.
func (c *SnapshotCache[T]) Start(ctx context.Context) {
	c.lifecycle = ctx
	go func() {
		_ = c.Refresh(ctx)
		ticker := time.NewTicker(c.interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				_ = c.Refresh(ctx)
			}
		}
	}()
}
