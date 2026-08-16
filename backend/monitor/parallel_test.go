package monitor

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

func TestRunBoundedLimitsConcurrentWork(t *testing.T) {
	var active atomic.Int32
	var peak atomic.Int32
	items := make([]int, 8)

	err := RunBounded(context.Background(), items, 2, func(ctx context.Context, _ int) error {
		current := active.Add(1)
		for {
			old := peak.Load()
			if current <= old || peak.CompareAndSwap(old, current) {
				break
			}
		}
		time.Sleep(25 * time.Millisecond)
		active.Add(-1)
		return nil
	})
	if err != nil {
		t.Fatalf("RunBounded returned an error: %v", err)
	}
	if got := peak.Load(); got > 2 {
		t.Fatalf("peak concurrency = %d; want at most 2", got)
	}
	if got := peak.Load(); got != 2 {
		t.Fatalf("peak concurrency = %d; want work to run concurrently", got)
	}
}

func TestRunBoundedReturnsWorkerError(t *testing.T) {
	want := "check failed"
	err := RunBounded(context.Background(), []int{1, 2, 3}, 2, func(_ context.Context, item int) error {
		if item == 2 {
			return testError(want)
		}
		return nil
	})
	if err == nil || err.Error() != want {
		t.Fatalf("RunBounded error = %v; want %q", err, want)
	}
}

type testError string

func (e testError) Error() string { return string(e) }
