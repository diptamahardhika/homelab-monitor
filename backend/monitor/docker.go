package monitor

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
)

type DockerContainer struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Image   string `json:"image"`
	State   string `json:"state"`
	Status  string `json:"status"`
	Ports   string `json:"ports"`
	Created int64  `json:"created"`
}

type ContainerStats struct {
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryUsageMB float64 `json:"memory_usage_mb"`
	MemoryLimitMB float64 `json:"memory_limit_mb"`
	MemoryPercent float64 `json:"memory_percent"`
	NetworkRxMB   float64 `json:"network_rx_mb"`
	NetworkTxMB   float64 `json:"network_tx_mb"`
}

type DockerContainerDetail struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	Created string            `json:"created"`
	State   string            `json:"state"`
	Status  string            `json:"status"`
	Ports   string            `json:"ports"`
	PID     int               `json:"pid"`
	Env     map[string]string `json:"env"`
	Mounts  []string          `json:"mounts"`
	Network string            `json:"network"`
	IP      string            `json:"ip"`
	Command string            `json:"command"`
	Size    string            `json:"size"`
	Uptime  string            `json:"uptime"`
	Stats   *ContainerStats   `json:"stats,omitempty"`
}

func getClient() (*client.Client, error) {
	return client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
}

func withClient(ctx context.Context, fn func(*client.Client) error) error {
	cli, err := getClient()
	if err != nil {
		return err
	}
	defer cli.Close()
	return fn(cli)
}

func GetDockerGatewayIP(ctx context.Context) string {
	var result string
	_ = withClient(ctx, func(cli *client.Client) error {
		if _, err := os.Stat("/var/run/docker.sock"); os.IsNotExist(err) {
			return nil
		}

		net, err := cli.NetworkInspect(ctx, "bridge", network.InspectOptions{})
		if err != nil {
			return nil
		}

		if len(net.IPAM.Config) > 0 {
			result = net.IPAM.Config[0].Gateway
		}
		return nil
	})
	return result
}

func GetDockerContainers(ctx context.Context) ([]DockerContainer, error) {
	var result []DockerContainer
	err := withClient(ctx, func(cli *client.Client) error {
		if _, err := os.Stat("/var/run/docker.sock"); os.IsNotExist(err) {
			result = []DockerContainer{}
			return nil
		}

		containers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
		if err != nil {
			result = []DockerContainer{}
			return nil
		}

		result = make([]DockerContainer, 0, len(containers))
		for _, c := range containers {
			name := ""
			if len(c.Names) > 0 {
				name = strings.TrimPrefix(c.Names[0], "/")
			}

			ports := ""
			for i, p := range c.Ports {
				if i > 0 {
					ports += ", "
				}
				if p.PublicPort > 0 {
					ports += itoa(int(p.PublicPort)) + ":" + itoa(int(p.PrivatePort)) + "/" + p.Type
				} else {
					ports += itoa(int(p.PrivatePort)) + "/" + p.Type
				}
			}

			id := c.ID
			if len(id) > 12 {
				id = id[:12]
			}

			result = append(result, DockerContainer{
				ID:      id,
				Name:    name,
				Image:   c.Image,
				State:   c.State,
				Status:  c.Status,
				Ports:   ports,
				Created: c.Created,
			})
		}

		return nil
	})
	return result, err
}

func GetContainerDetail(ctx context.Context, containerID string) (*DockerContainerDetail, error) {
	var result *DockerContainerDetail
	err := withClient(ctx, func(cli *client.Client) error {
		if _, err := os.Stat("/var/run/docker.sock"); os.IsNotExist(err) {
			return nil
		}

		detail, _, err := cli.ContainerInspectWithRaw(ctx, containerID, false)
		if err != nil {
			return err
		}

		name := strings.TrimPrefix(detail.Name, "/")

		ports := ""
		for port, bindings := range detail.NetworkSettings.Ports {
			portStr := string(port)
			for _, b := range bindings {
				if ports != "" {
					ports += ", "
				}
				if b.HostPort != "" {
					ports += b.HostPort + ":" + portStr
				} else {
					ports += portStr
				}
			}
		}

		env := make(map[string]string)
		for _, e := range detail.Config.Env {
			parts := strings.SplitN(e, "=", 2)
			if len(parts) == 2 {
				env[parts[0]] = parts[1]
			}
		}

		mounts := make([]string, 0, len(detail.Mounts))
		for _, m := range detail.Mounts {
			mounts = append(mounts, m.Source+" -> "+m.Destination)
		}

		network := ""
		ip := ""
		for name, net := range detail.NetworkSettings.Networks {
			network = name
			ip = net.IPAddress
		}

		uptime := ""
		if detail.State.Running {
			started := detail.State.StartedAt
			t, err := time.Parse(time.RFC3339Nano, started)
			if err == nil {
				d := time.Since(t)
				h := int(d.Hours())
				m := int(d.Minutes()) % 60
				if h > 24 {
					uptime = itoa(h/24) + "d " + itoa(h%24) + "h"
				} else {
					uptime = itoa(h) + "h " + itoa(m) + "m"
				}
			}
		}

		created := ""
		t, err := time.Parse(time.RFC3339Nano, detail.Created)
		if err == nil {
			created = t.Format("Jan 2, 2006 15:04")
		}

		result = &DockerContainerDetail{
			ID:      detail.ID[:12],
			Name:    name,
			Image:   detail.Config.Image,
			Created: created,
			State:   detail.State.Status,
			Status:  detail.State.Status,
			Ports:   ports,
			PID:     detail.State.Pid,
			Env:     env,
			Mounts:  mounts,
			Network: network,
			IP:      ip,
			Command: strings.Join(detail.Config.Cmd, " "),
			Uptime:  uptime,
		}

		if detail.State.Running {
			result.Stats = GetContainerStats(ctx, containerID)
		}

		if detail.State.Running {
			result.Status = "running"
		} else if detail.State.ExitCode != 0 {
			result.Status = "exited (" + itoa(detail.State.ExitCode) + ")"
		} else {
			result.Status = "exited"
		}

		return nil
	})
	return result, err
}

func GetContainerStats(ctx context.Context, containerID string) *ContainerStats {
	var result *ContainerStats
	_ = withClient(ctx, func(cli *client.Client) error {
		resp, err := cli.ContainerStats(ctx, containerID, false)
		if err != nil {
			return nil
		}
		defer resp.Body.Close()

		var raw struct {
			CPUStats struct {
				CPUUsage struct {
					TotalUsage float64 `json:"total_usage"`
				} `json:"cpu_usage"`
				SystemCPUUsage float64 `json:"system_cpu_usage"`
				OnlineCPUs     uint    `json:"online_cpus"`
			} `json:"cpu_stats"`
			PrecpuStats struct {
				CPUUsage struct {
					TotalUsage float64 `json:"total_usage"`
				} `json:"cpu_usage"`
				SystemCPUUsage float64 `json:"system_cpu_usage"`
			} `json:"precpu_stats"`
			MemoryStats struct {
				Usage float64 `json:"usage"`
				Limit float64 `json:"limit"`
				Stats struct {
					Cache float64 `json:"cache"`
				} `json:"stats"`
			} `json:"memory_stats"`
			Networks map[string]struct {
				RxBytes float64 `json:"rx_bytes"`
				TxBytes float64 `json:"tx_bytes"`
			} `json:"networks"`
		}

		data, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil
		}

		if err := json.Unmarshal(data, &raw); err != nil {
			return nil
		}

		cpuDelta := raw.CPUStats.CPUUsage.TotalUsage - raw.PrecpuStats.CPUUsage.TotalUsage
		systemDelta := raw.CPUStats.SystemCPUUsage - raw.PrecpuStats.SystemCPUUsage
		cpuPercent := 0.0
		if systemDelta > 0 && raw.CPUStats.OnlineCPUs > 0 {
			cpuPercent = (cpuDelta / systemDelta) * float64(raw.CPUStats.OnlineCPUs) * 100
		}

		cache := raw.MemoryStats.Stats.Cache
		memUsage := raw.MemoryStats.Usage
		if cache > 0 && memUsage > cache {
			memUsage = memUsage - cache
		}
		memLimit := raw.MemoryStats.Limit
		memPercent := 0.0
		if memLimit > 0 {
			memPercent = (memUsage / memLimit) * 100
		}

		var rxBytes, txBytes float64
		for _, net := range raw.Networks {
			rxBytes += net.RxBytes
			txBytes += net.TxBytes
		}

		result = &ContainerStats{
			CPUPercent:    round2(cpuPercent),
			MemoryUsageMB: round2(memUsage / 1024 / 1024),
			MemoryLimitMB: round2(memLimit / 1024 / 1024),
			MemoryPercent: round2(memPercent),
			NetworkRxMB:   round2(rxBytes / 1024 / 1024),
			NetworkTxMB:   round2(txBytes / 1024 / 1024),
		}
		return nil
	})
	return result
}

func round2(v float64) float64 {
	return float64(int(v*100)) / 100
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [12]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
