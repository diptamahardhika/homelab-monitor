package monitor

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"
)

type ServerStatus struct {
	Name   string `json:"name"`
	Host   string `json:"host"`
	Port   int    `json:"port"`
	Type   string `json:"type"`
	Alive  bool   `json:"alive"`
	Latency string `json:"latency"`
	Error  string `json:"error,omitempty"`
}

func CheckServer(ctx context.Context, name, host string, port int, checkType string, dialHost ...string) ServerStatus {
	status := ServerStatus{
		Name: name,
		Host: host,
		Port: port,
		Type: checkType,
	}

	addr := host
	if len(dialHost) > 0 && dialHost[0] != "" {
		addr = dialHost[0]
	}

	start := time.Now()

	switch checkType {
	case "http":
		url := fmt.Sprintf("http://%s:%d", addr, port)
		if port == 0 || port == 80 || port == 443 {
			url = fmt.Sprintf("http://%s", addr)
		}
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get(url)
		latency := time.Since(start)
		if err != nil {
			status.Alive = false
			status.Error = err.Error()
			return status
		}
		defer resp.Body.Close()
		status.Alive = resp.StatusCode >= 200 && resp.StatusCode < 500
		if !status.Alive {
			status.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())

	case "tcp":
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", addr, port), 5*time.Second)
		latency := time.Since(start)
		if err != nil {
			status.Alive = false
			status.Error = err.Error()
			return status
		}
		conn.Close()
		status.Alive = true
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())

	default:
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", addr, port), 5*time.Second)
		latency := time.Since(start)
		if err != nil {
			status.Alive = false
			status.Error = err.Error()
			return status
		}
		conn.Close()
		status.Alive = true
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())
	}

	return status
}

func CheckService(ctx context.Context, name, url string, checkType string) ServiceStatus {
	status := ServiceStatus{
		Name: name,
		URL:  url,
		Type: checkType,
	}

	start := time.Now()

	switch checkType {
	case "http":
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Get(url)
		latency := time.Since(start)
		if err != nil {
			status.Status = "down"
			status.Error = err.Error()
			return status
		}
		defer resp.Body.Close()
		status.StatusCode = resp.StatusCode
		if resp.StatusCode >= 200 && resp.StatusCode < 400 {
			status.Status = "up"
		} else {
			status.Status = "degraded"
		}
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())

	case "tcp":
		conn, err := net.DialTimeout("tcp", url, 5*time.Second)
		latency := time.Since(start)
		if err != nil {
			status.Status = "down"
			status.Error = err.Error()
			return status
		}
		conn.Close()
		status.Status = "up"
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())
	}

	return status
}
