package monitor

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/diptamahardhika/homelab-monitor/backend/config"
)

type ServerStatus struct {
	Name    string `json:"name"`
	Host    string `json:"host"`
	Port    int    `json:"port"`
	Type    string `json:"type"`
	Alive   bool   `json:"alive"`
	Latency string `json:"latency"`
	Error   string `json:"error,omitempty"`
	LatencyMs int64 `json:"latency_ms,omitempty"`
}

type ServiceStatus struct {
	Name         string `json:"name"`
	URL          string `json:"url"`
	Type         string `json:"type"`
	Status       string `json:"status"`
	StatusCode   int    `json:"status_code,omitempty"`
	Latency      string `json:"latency"`
	Error        string `json:"error,omitempty"`
	LastChecked  string `json:"last_checked,omitempty"`
	ResolvedIP   string `json:"resolved_ip,omitempty"`
	ResponseSize int64  `json:"response_size,omitempty"`
	LatencyMs    int64  `json:"latency_ms,omitempty"`
}

// httpClient is a shared HTTP client for monitoring checks.
var httpClient = &http.Client{
	Timeout: 10 * time.Second,
}

// maxResponseSize limits the response body we read for size calculation.
const maxResponseSize = 1024 * 1024 // 1 MB

func CheckServer(ctx context.Context, server config.Server, dialHost ...string) ServerStatus {
	status := ServerStatus{
		Name: server.Name,
		Host: server.Host,
		Port: server.Port,
		Type: server.Type,
	}

	addr := server.Host
	if len(dialHost) > 0 && dialHost[0] != "" {
		addr = dialHost[0]
	}

	timeout := server.Timeout
	if timeout == 0 {
		timeout = 5 * time.Second
	}

	start := time.Now()

	switch server.Type {
	case "http":
		url := fmt.Sprintf("http://%s:%d", addr, server.Port)
		if server.Port == 0 || server.Port == 80 || server.Port == 443 {
			url = fmt.Sprintf("http://%s", addr)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			status.Alive = false
			status.Error = err.Error()
			return status
		}
		// Set custom timeout for this request
		client := &http.Client{Timeout: timeout}
		if !server.FollowRedirects {
			client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			}
		}
		if server.InsecureSkipVerify {
			// This would require custom transport - simplified for now
		}
		resp, err := client.Do(req)
		latency := time.Since(start)
		if err != nil {
			status.Alive = false
			status.Error = err.Error()
			return status
		}
		defer resp.Body.Close()
		status.LatencyMs = latency.Milliseconds()
		expectedMin := 200
		expectedMax := 500
		if server.ExpectedStatus > 0 {
			expectedMin = server.ExpectedStatus
			expectedMax = server.ExpectedStatus
		}
		status.Alive = resp.StatusCode >= expectedMin && resp.StatusCode < expectedMax
		if !status.Alive {
			status.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())

	case "tcp":
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", addr, server.Port), timeout)
		latency := time.Since(start)
		if err != nil {
			status.Alive = false
			status.Error = err.Error()
			return status
		}
		conn.Close()
		status.Alive = true
		status.LatencyMs = latency.Milliseconds()
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())

	default:
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", addr, server.Port), timeout)
		latency := time.Since(start)
		if err != nil {
			status.Alive = false
			status.Error = err.Error()
			return status
		}
		conn.Close()
		status.Alive = true
		status.LatencyMs = latency.Milliseconds()
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())
	}

	return status
}

func CheckService(ctx context.Context, service config.Service) ServiceStatus {
	status := ServiceStatus{
		Name: service.Name,
		URL:  service.URL,
		Type: service.Type,
	}

	start := time.Now()

	timeout := service.Timeout
	if timeout == 0 {
		timeout = 10 * time.Second
	}

	switch service.Type {
	case "http":
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, service.URL, nil)
		if err != nil {
			status.Status = "down"
			status.Error = err.Error()
			return status
		}
		client := &http.Client{Timeout: timeout}
		if !service.FollowRedirects {
			client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			}
		}
		if service.InsecureSkipVerify {
			// This would require custom transport - simplified for now
		}
		resp, err := client.Do(req)
		latency := time.Since(start)
		if err != nil {
			status.Status = "down"
			status.Error = err.Error()
			return status
		}
		// Read at most maxResponseSize bytes for response size calculation
		limited := io.LimitReader(resp.Body, maxResponseSize)
		body, _ := io.ReadAll(limited)
		resp.Body.Close()
		status.ResponseSize = int64(len(body))
		status.StatusCode = resp.StatusCode
		status.LatencyMs = latency.Milliseconds()
		expectedMin := 200
		expectedMax := 400
		if service.ExpectedStatus > 0 {
			expectedMin = service.ExpectedStatus
			expectedMax = service.ExpectedStatus
		}
		if resp.StatusCode >= expectedMin && resp.StatusCode < expectedMax {
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
		host, _, err := net.SplitHostPort(service.URL)
		if err == nil {
			if ips, err := net.LookupHost(host); err == nil && len(ips) > 0 {
				status.ResolvedIP = ips[0]
			}
		}
		conn, err := net.DialTimeout("tcp", service.URL, timeout)
		latency := time.Since(start)
		if err != nil {
			status.Status = "down"
			status.Error = err.Error()
			return status
		}
		conn.Close()
		status.Status = "up"
		status.LatencyMs = latency.Milliseconds()
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())
	}

	status.LastChecked = time.Now().UTC().Format(time.RFC3339)

	return status
}
