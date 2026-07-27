package monitor

import (
	"encoding/binary"
	"runtime"
	"time"

	"golang.org/x/sys/unix"
)

func getMacCPUUsage() float64 {
	raw, err := unix.SysctlRaw("vm.loadavg")
	if err != nil || len(raw) < 12 {
		return 0
	}
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

func readMacUptime() string {
	raw, err := unix.SysctlRaw("kern.boottime")
	if err != nil || len(raw) < 16 {
		return ""
	}
	sec := int64(binary.LittleEndian.Uint64(raw[0:8]))
	boot := time.Unix(sec, 0)
	return formatDuration(time.Since(boot))
}
