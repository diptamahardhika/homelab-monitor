package monitor

import (
	"context"
	"encoding/binary"
	"math"
	"os"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/docker/docker/client"
	"golang.org/x/sys/unix"
)

type SystemStats struct {
	Hostname          string  `json:"hostname"`
	OS                string  `json:"os"`
	Kernel            string  `json:"kernel"`
	Uptime            string  `json:"uptime"`
	CPUCount          int     `json:"cpu_count"`
	CPUUsagePercent   float64 `json:"cpu_usage_percent"`
	MemoryTotalMB     uint64  `json:"memory_total_mb"`
	MemoryUsedMB      uint64  `json:"memory_used_mb"`
	MemoryFreeMB      uint64  `json:"memory_free_mb"`
	MemoryUsedPercent float64 `json:"memory_used_percent"`
	DiskTotalGB       uint64  `json:"disk_total_gb"`
	DiskUsedGB        uint64  `json:"disk_used_gb"`
	DiskFreeGB        uint64  `json:"disk_free_gb"`
	DiskUsedPercent   float64 `json:"disk_used_percent"`
}

func GetSystemStats(ctx context.Context) *SystemStats {
	stats := &SystemStats{
		Hostname: getHostname(),
		OS:       runtime.GOOS,
		CPUCount: runtime.NumCPU(),
	}

	if cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation()); err == nil {
		info, err := cli.Info(ctx)
		if err == nil {
			stats.Hostname = info.Name
			stats.OS = info.OperatingSystem
			stats.Kernel = info.KernelVersion
			if info.NCPU > 0 {
				stats.CPUCount = int(info.NCPU)
			}
			if info.MemTotal > 0 {
				stats.MemoryTotalMB = uint64(info.MemTotal / 1024 / 1024)
			}
		}
		cli.Close()
	}

	stats.CPUUsagePercent = getCPUUsage()

	memTotalKB, memAvailKB := readMemInfo()
	if memTotalKB > 0 {
		stats.MemoryTotalMB = memTotalKB / 1024
		stats.MemoryFreeMB = memAvailKB / 1024
		if memTotalKB > memAvailKB {
			stats.MemoryUsedMB = (memTotalKB - memAvailKB) / 1024
		}
		if stats.MemoryTotalMB > 0 {
			stats.MemoryUsedPercent = toFixed(float64(stats.MemoryUsedMB)/float64(stats.MemoryTotalMB)*100, 1)
		}
	}

	diskTotal, diskFree := readDiskUsage()
	if diskTotal > 0 {
		stats.DiskTotalGB = diskTotal / 1024 / 1024 / 1024
		stats.DiskFreeGB = diskFree / 1024 / 1024 / 1024
		if stats.DiskTotalGB > stats.DiskFreeGB {
			stats.DiskUsedGB = stats.DiskTotalGB - stats.DiskFreeGB
		}
		if stats.DiskTotalGB > 0 {
			stats.DiskUsedPercent = toFixed(float64(stats.DiskUsedGB)/float64(stats.DiskTotalGB)*100, 1)
		}
	}

	stats.Uptime = readUptime()

	return stats
}

func getHostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}

func getCPUUsage() float64 {
	idle1, total1 := readCPUStat()
	if total1 == 0 {
		return getMacCPUUsage()
	}
	time.Sleep(300 * time.Millisecond)
	idle2, total2 := readCPUStat()
	if total2 == 0 {
		return 0
	}
	deltaIdle := idle2 - idle1
	deltaTotal := total2 - total1
	if deltaTotal == 0 {
		return 0
	}
	return toFixed(float64(deltaTotal-deltaIdle)/float64(deltaTotal)*100, 1)
}

func readCPUStat() (idle uint64, total uint64) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0
	}
	for _, line := range strings.Split(string(data), "\n") {
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			return 0, 0
		}
		for i := 1; i < len(fields); i++ {
			v, _ := strconv.ParseUint(fields[i], 10, 64)
			total += v
			if i == 4 {
				idle = v
			}
		}
		return
	}
	return 0, 0
}

func getMacCPUUsage() float64 {
	raw, err := unix.SysctlRaw("vm.loadavg")
	if err != nil || len(raw) < 12 {
		return 0
	}
	// fixpt_t values divided by FSCALE (2048) give load averages
	ldavg := int32(binary.LittleEndian.Uint32(raw[0:4]))
	load1 := float64(ldavg) / 2048.0
	cpus := runtime.NumCPU()
	if cpus <= 0 {
		return 0
	}
	pct := (load1 / float64(cpus)) * 100
	if pct > 100 {
		pct = 100
	}
	return toFixed(pct, 1)
}

func readMemInfo() (totalKB uint64, availKB uint64) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return readMacMemInfo()
	}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				totalKB, _ = strconv.ParseUint(fields[1], 10, 64)
			}
		} else if strings.HasPrefix(line, "MemAvailable:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				availKB, _ = strconv.ParseUint(fields[1], 10, 64)
			}
		}
	}
	return
}

func readMacMemInfo() (totalKB uint64, freeKB uint64) {
	totalBytes, err := unix.SysctlUint64("hw.memsize")
	if err != nil || totalBytes == 0 {
		return 0, 0
	}
	totalKB = totalBytes / 1024

	pageSize, err := unix.SysctlUint64("hw.pagesize")
	if err != nil || pageSize == 0 {
		pageSize = 16384
	}

	freeRaw, err := unix.SysctlRaw("vm.page_free_count")
	if err != nil || len(freeRaw) < 4 {
		return totalKB, totalKB / 2
	}
	freePages := uint64(binary.LittleEndian.Uint32(freeRaw[0:4]))

	specRaw, err := unix.SysctlRaw("vm.page_speculative_count")
	if err == nil && len(specRaw) >= 4 {
		specPages := uint64(binary.LittleEndian.Uint32(specRaw[0:4]))
		freePages += specPages
	}

	freeBytes := freePages * pageSize
	freeKB = freeBytes / 1024
	if freeKB > totalKB {
		freeKB = totalKB / 2
	}
	return
}

func readDiskUsage() (total uint64, free uint64) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err != nil {
		return 0, 0
	}
	blockSize := uint64(stat.Bsize)
	total = stat.Blocks * blockSize
	free = stat.Bavail * blockSize
	return
}

func readUptime() string {
	data, err := os.ReadFile("/proc/uptime")
	if err == nil {
		fields := strings.Fields(string(data))
		if len(fields) > 0 {
			secs, _ := strconv.ParseFloat(fields[0], 64)
			return formatDuration(time.Duration(secs) * time.Second)
		}
	}
	return readMacUptime()
}

func readMacUptime() string {
	raw, err := unix.SysctlRaw("kern.boottime")
	if err != nil || len(raw) < 16 {
		return ""
	}
	sec := int64(binary.LittleEndian.Uint64(raw[0:8]))
	boot := time.Unix(sec, 0)
	return formatDuration(time.Since(boot))
}

func formatDuration(d time.Duration) string {
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	if h > 24 {
		return strconv.Itoa(h/24) + "d " + strconv.Itoa(h%24) + "h"
	}
	return strconv.Itoa(h) + "h " + strconv.Itoa(m) + "m"
}

func toFixed(f float64, prec int) float64 {
	pow := math.Pow10(prec)
	return math.Round(f*pow) / pow
}
