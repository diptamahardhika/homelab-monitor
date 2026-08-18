package monitor

import "testing"

func TestAppendPortDedupes(t *testing.T) {
	ports := ""
	seen := make(map[string]struct{})
	appendPort(&ports, seen, "9000:9000/tcp")
	appendPort(&ports, seen, "9000:9000/tcp")
	appendPort(&ports, seen, "8080:80/tcp")
	if ports != "9000:9000/tcp, 8080:80/tcp" {
		t.Fatalf("unexpected ports string: %q", ports)
	}
}

func TestComputeContainerStatsCPUPercent(t *testing.T) {
	frame := func(total, system float64) dockerStatsFrame {
		var f dockerStatsFrame
		f.CPUStats.CPUUsage.TotalUsage = total
		f.CPUStats.SystemCPUUsage = system
		return f
	}

	// prev uses 1000 cpu ticks over 10000 system ticks, cur uses 2000/20000.
	// delta = (1000/10000) = 0.1 of one core = 10% on a single core.
	prev := frame(1000, 10000)
	cur := frame(2000, 20000)
	cur.CPUStats.OnlineCPUs = 1

	stats := computeContainerStats(prev, cur)
	if stats.CPUPercent != 10 {
		t.Fatalf("expected 10%% CPU, got %v", stats.CPUPercent)
	}
}

func TestComputeContainerStatsIdenticalFrames(t *testing.T) {
	// No delta between frames => 0% CPU, not a nonsense negative or NaN.
	prev := dockerStatsFrame{}
	prev.CPUStats.OnlineCPUs = 4
	stats := computeContainerStats(prev, prev)
	if stats.CPUPercent != 0 {
		t.Fatalf("expected 0%% CPU for identical frames, got %v", stats.CPUPercent)
	}
}

func TestComputeContainerStatsMemory(t *testing.T) {
	var prev dockerStatsFrame
	var cur dockerStatsFrame
	cur.MemoryStats.Usage = 1024 * 1024 * 512 // 512 MB
	cur.MemoryStats.Limit = 1024 * 1024 * 1024
	cur.MemoryStats.Stats.Cache = 0

	stats := computeContainerStats(prev, cur)
	if stats.MemoryUsageMB != 512 {
		t.Fatalf("expected 512 MB usage, got %v", stats.MemoryUsageMB)
	}
	if stats.MemoryPercent != 50 {
		t.Fatalf("expected 50%% memory, got %v", stats.MemoryPercent)
	}
}
