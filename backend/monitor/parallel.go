package monitor

import (
	"context"
	"sync"
)

// RunBounded applies check to every item while limiting simultaneous checks.
// It returns the first worker error after all workers have stopped.
func RunBounded[T any](ctx context.Context, items []T, limit int, check func(context.Context, T) error) error {
	if len(items) == 0 {
		return nil
	}
	if limit < 1 {
		limit = 1
	}
	if limit > len(items) {
		limit = len(items)
	}

	jobs := make(chan T)
	var workers sync.WaitGroup
	var errOnce sync.Once
	var firstErr error

	for range limit {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for item := range jobs {
				if err := check(ctx, item); err != nil {
					errOnce.Do(func() { firstErr = err })
				}
			}
		}()
	}

	for _, item := range items {
		select {
		case <-ctx.Done():
			close(jobs)
			workers.Wait()
			return ctx.Err()
		case jobs <- item:
		}
	}
	close(jobs)
	workers.Wait()
	return firstErr
}
