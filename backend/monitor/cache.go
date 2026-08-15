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

	mu        sync.RWMutex
	snapshot  T
	hasValue  bool
	updatedAt time.Time
	refreshMu sync.Mutex
}

func NewSnapshotCache[T any](interval time.Duration, refresh func(context.Context) (T, error)) *SnapshotCache[T] {
	return &SnapshotCache[T]{interval: interval, refresh: refresh}
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

func (c *SnapshotCache[T]) Refresh(ctx context.Context) error {
	c.refreshMu.Lock()
	defer c.refreshMu.Unlock()

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
	c.mu.Unlock()
	return nil
}

// Start refreshes the snapshot immediately, then on interval until ctx ends.
func (c *SnapshotCache[T]) Start(ctx context.Context) {
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
