package monitor

import (
	"context"
	"fmt"
	"io"
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

func CheckService(ctx context.Context, name, rawURL string, checkType string) ServiceStatus {
	status := ServiceStatus{
		Name: name,
		URL:  rawURL,
		Type: checkType,
	}

	start := time.Now()

	switch checkType {
	case "http":
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Get(rawURL)
		latency := time.Since(start)
		if err != nil {
			status.Status = "down"
			status.Error = err.Error()
			return status
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		status.ResponseSize = int64(len(body))
		status.StatusCode = resp.StatusCode
		if resp.StatusCode >= 200 && resp.StatusCode < 400 {
			status.Status = "up"
		} else {
			status.Status = "degraded"
		}
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())

		if host := resp.Request.URL.Hostname(); host != "" {
			if ips, err := net.LookupHost(host); err == nil && len(ips) > 0 {
				status.ResolvedIP = ips[0]
			}
		}

	case "tcp":
		host, _, err := net.SplitHostPort(rawURL)
		if err == nil {
			if ips, err := net.LookupHost(host); err == nil && len(ips) > 0 {
				status.ResolvedIP = ips[0]
			}
		}
		conn, err := net.DialTimeout("tcp", rawURL, 5*time.Second)
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

	status.LastChecked = time.Now().UTC().Format(time.RFC3339)

	return status
}
