package monitor

import (
	"context"
	"os"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
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
}

func getClient() (*client.Client, error) {
	return client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
}

func GetDockerContainers(ctx context.Context) ([]DockerContainer, error) {
	if _, err := os.Stat("/var/run/docker.sock"); os.IsNotExist(err) {
		return []DockerContainer{}, nil
	}

	cli, err := getClient()
	if err != nil {
		return nil, err
	}

	containers, err := cli.ContainerList(ctx, types.ContainerListOptions{All: true})
	if err != nil {
		return nil, err
	}

	result := make([]DockerContainer, 0, len(containers))
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

	return result, nil
}

func GetContainerDetail(ctx context.Context, containerID string) (*DockerContainerDetail, error) {
	if _, err := os.Stat("/var/run/docker.sock"); os.IsNotExist(err) {
		return nil, nil
	}

	cli, err := getClient()
	if err != nil {
		return nil, err
	}

	detail, err := cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return nil, err
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

	result := &DockerContainerDetail{
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
		result.Status = "running"
	} else if detail.State.ExitCode != 0 {
		result.Status = "exited (" + itoa(detail.State.ExitCode) + ")"
	} else {
		result.Status = "exited"
	}

	return result, nil
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
