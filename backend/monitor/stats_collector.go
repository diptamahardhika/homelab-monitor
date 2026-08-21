package monitor

import (
	"context"
	"os"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
)

var (
	statsMu       sync.RWMutex
	statsSnapshot = map[string]*ContainerStats{} // short container id -> latest stats
)

// StartContainerStatsCollector refreshes per-container stats in the background
// so overview collection never blocks on the ~1s two-frame stats stream. The
// snapshot map is swapped atomically on each pass; ids that disappeared are
// dropped with it.
func StartContainerStatsCollector(ctx context.Context, interval time.Duration) {
	go func() {
		collect := func() {
			latest := collectRunningStats(ctx)
			if latest == nil {
				return
			}
			statsMu.Lock()
			statsSnapshot = latest
			statsMu.Unlock()
		}
		collect()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				collect()
			}
		}
	}()
}

func collectRunningStats(ctx context.Context) map[string]*ContainerStats {
	if _, err := os.Stat("/var/run/docker.sock"); os.IsNotExist(err) {
		return nil
	}
	cli, err := getSharedClient()
	if err != nil {
		return nil
	}
	containers, err := cli.ContainerList(ctx, container.ListOptions{All: false})
	if err != nil {
		return nil
	}
	ids := make([]string, 0, len(containers))
	for _, c := range containers {
		if c.State == "running" {
			id := c.ID
			if len(id) > 12 {
				id = id[:12]
			}
			ids = append(ids, id)
		}
	}
	out := make(map[string]*ContainerStats, len(ids))
	_ = RunBounded(ctx, ids, 8, func(ctx context.Context, id string) error {
		if st := GetContainerStats(ctx, id); st != nil {
			out[id] = st
		}
		return nil
	})
	return out
}

// cachedContainerStats returns the most recent background sample for a short
// container id, or nil when none has been collected yet.
func cachedContainerStats(id string) *ContainerStats {
	statsMu.RLock()
	defer statsMu.RUnlock()
	return statsSnapshot[id]
}
