package monitor

import (
	"context"
	"math"
	"net"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/docker/docker/client"
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
	NetworkRXSpeed    float64 `json:"network_rx_speed"`
	NetworkTXSpeed    float64 `json:"network_tx_speed"`
	IPAddress         string  `json:"ip_address"`
}

var (
	prevNetMu   sync.Mutex
	prevNetRX   uint64
	prevNetTX   uint64
	prevNetTime time.Time
)

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

	rxSpeed, txSpeed := getNetworkSpeed()
	stats.NetworkRXSpeed = rxSpeed
	stats.NetworkTXSpeed = txSpeed

	stats.IPAddress = getIPAddress()

	return stats
}

func getHostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}

func getIPAddress() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipnet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return ""
}

func getNetworkSpeed() (rxBytesPerSec float64, txBytesPerSec float64) {
	data, err := os.ReadFile("/proc/net/dev")
	if err != nil {
		return 0, 0
	}

	var rx, tx uint64
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 10 {
			continue
		}
		iface := strings.TrimRight(fields[0], ":")
		if iface == "lo" || iface == "lo0" {
			continue
		}
		rx, _ = strconv.ParseUint(fields[1], 10, 64)
		tx, _ = strconv.ParseUint(fields[9], 10, 64)
		break
	}

	now := time.Now()
	prevNetMu.Lock()
	if !prevNetTime.IsZero() && now.After(prevNetTime) {
		elapsed := now.Sub(prevNetTime).Seconds()
		if elapsed > 0 && rx >= prevNetRX && tx >= prevNetTX {
			rxBytesPerSec = float64(rx-prevNetRX) / elapsed
			txBytesPerSec = float64(tx-prevNetTX) / elapsed
		}
	}
	prevNetRX = rx
	prevNetTX = tx
	prevNetTime = now
	prevNetMu.Unlock()

	return
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
