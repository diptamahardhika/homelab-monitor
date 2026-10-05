package monitor

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/pradiptamahardika/homelab-monitor/config"
)

// magicDNSAddr is the Tailscale MagicDNS resolver. It only ever answers for
// *.ts.net names; everything else falls through to the tailnet's configured
// upstream resolvers.
const magicDNSAddr = "100.100.100.100:53"

// magicDNSBudget bounds the time spent probing MagicDNS for a single host. The
// dial to 100.100.100.100 is cheap, but the follow-up lookup can stall for
// hundreds of milliseconds when that address is filtered rather than refused.
// Without a cap, a dead MagicDNS adds that stall to every check of every
// *.ts.net service on every refresh cycle.
const magicDNSBudget = 150 * time.Millisecond

// tailnetResolver queries MagicDNS directly. Containers inherit the Docker
// daemon's resolver (127.0.0.11 -> the daemon host's resolver), which does not
// answer MagicDNS queries, so tailnet hosts must be resolved explicitly or
// every check fails with "no such host" even though the peer is reachable.
var tailnetResolver = &net.Resolver{
	PreferGo: true,
	Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
		d := net.Dialer{Timeout: 2 * time.Second}
		return d.DialContext(ctx, network, magicDNSAddr)
	},
}

// isTailnetHost reports whether host is a MagicDNS name. Only these names get
// the extra resolver lookup, so non-Tailscale deployments pay nothing.
func isTailnetHost(host string) bool {
	return strings.HasSuffix(strings.ToLower(strings.TrimSuffix(host, ".")), ".ts.net")
}

// resolveTailnetHost resolves a *.ts.net host through MagicDNS. It returns ""
// when host is not a tailnet name or MagicDNS is unreachable, so callers fall
// back to normal DNS resolution.
func resolveTailnetHost(ctx context.Context, host string) string {
	if !isTailnetHost(host) {
		return ""
	}
	// Bound the probe so an unreachable or filtered MagicDNS cannot add its
	// full stall to every check. The parent ctx still wins if it expires first.
	lookupCtx, cancel := context.WithTimeout(ctx, magicDNSBudget)
	defer cancel()
	ips, err := tailnetResolver.LookupHost(lookupCtx, host)
	if err != nil {
		return ""
	}
	for _, ip := range ips {
		if parsed := net.ParseIP(ip); parsed != nil {
			return ip
		}
	}
	return ""
}

// firstResolvedIP returns an IP for host, preferring MagicDNS for tailnet
// names. Used for the ResolvedIP display field.
func firstResolvedIP(ctx context.Context, host string) string {
	if ip := resolveTailnetHost(ctx, host); ip != "" {
		return ip
	}
	if ips, err := net.LookupHost(host); err == nil && len(ips) > 0 {
		return ips[0]
	}
	return ""
}

// dialTCP dials addr, transparently resolving MagicDNS names through Tailscale
// before handing the address to the system resolver.
func dialTCP(ctx context.Context, addr string, timeout time.Duration) (net.Conn, error) {
	dialer := &net.Dialer{Timeout: timeout}
	return tailnetDialer(dialer)(ctx, "tcp", addr)
}

// tailnetDialer wraps a dialer so *.ts.net hosts resolve via MagicDNS first.
func tailnetDialer(dialer *net.Dialer) func(context.Context, string, string) (net.Conn, error) {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(addr)
		if err != nil {
			return dialer.DialContext(ctx, network, addr)
		}
		if ip := resolveTailnetHost(ctx, host); ip != "" {
			return dialer.DialContext(ctx, network, net.JoinHostPort(ip, port))
		}
		return dialer.DialContext(ctx, network, addr)
	}
}

var (
	// sharedTransport is reused by every check so connections are pooled and
	// keep-alive across the 10s monitoring cycles instead of being re-created.
	sharedTransport = &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           tailnetDialer(&net.Dialer{Timeout: 5 * time.Second, KeepAlive: 30 * time.Second}),
		MaxIdleConns:          64,
		MaxIdleConnsPerHost:   8,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ForceAttemptHTTP2:     true,
	}
	// insecureTransport is used only by checks with insecure_skip_verify set.
	insecureTransport = &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           tailnetDialer(&net.Dialer{Timeout: 5 * time.Second, KeepAlive: 30 * time.Second}),
		MaxIdleConns:          64,
		MaxIdleConnsPerHost:   8,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ForceAttemptHTTP2:     true,
		TLSClientConfig:       &tls.Config{InsecureSkipVerify: true},
	}
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

// parseTimeout converts a config timeout string ("5s") into a duration,
// falling back to def when empty or malformed.
func parseTimeout(raw string, def time.Duration) time.Duration {
	if raw == "" {
		return def
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return def
	}
	return d
}

// checkClient builds a per-check http.Client. Transports are shared so
// connections pool across checks; the client carries per-check behavior
// (timeout, redirect handling) and is cheap to construct.
func checkClient(timeout time.Duration, followRedirects, insecure bool) *http.Client {
	transport := sharedTransport
	if insecure {
		transport = insecureTransport
	}
	c := &http.Client{Timeout: timeout, Transport: transport}
	if !followRedirects {
		c.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}
	return c
}

func CheckServer(ctx context.Context, srv config.Server, dialHost ...string) ServerStatus {
	status := ServerStatus{
		Name: srv.Name,
		Host: srv.Host,
		Port: srv.Port,
		Type: srv.Type,
	}

	addr := srv.Host
	if len(dialHost) > 0 && dialHost[0] != "" {
		addr = dialHost[0]
	}

	start := time.Now()

	switch srv.Type {
	case "http":
		url := fmt.Sprintf("http://%s:%d", addr, srv.Port)
		if srv.Port == 0 || srv.Port == 80 {
			url = fmt.Sprintf("http://%s", addr)
		} else if srv.Port == 443 {
			url = fmt.Sprintf("https://%s", addr)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			status.Alive = false
			status.Error = err.Error()
			return status
		}
		resp, err := checkClient(parseTimeout(srv.Timeout, 5*time.Second), srv.FollowRedirects, srv.InsecureSkipVerify).Do(req)
		latency := time.Since(start)
		if err != nil {
			status.Alive = false
			status.Error = err.Error()
			return status
		}
		defer resp.Body.Close()
		status.Alive = resp.StatusCode >= 200 && resp.StatusCode < 500
		if srv.ExpectedStatus > 0 {
			status.Alive = resp.StatusCode == srv.ExpectedStatus
		}
		if !status.Alive {
			status.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())

	case "tcp":
		conn, err := dialTCP(ctx, fmt.Sprintf("%s:%d", addr, srv.Port), parseTimeout(srv.Timeout, 5*time.Second))
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
		conn, err := dialTCP(ctx, fmt.Sprintf("%s:%d", addr, srv.Port), parseTimeout(srv.Timeout, 5*time.Second))
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

func CheckService(ctx context.Context, svc config.Service) ServiceStatus {
	status := ServiceStatus{
		Name: svc.Name,
		URL:  svc.URL,
		Type: svc.Type,
	}

	start := time.Now()

	switch svc.Type {
	case "http":
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, svc.URL, nil)
		if err != nil {
			status.Status = "down"
			status.Error = err.Error()
			return status
		}
		resp, err := checkClient(parseTimeout(svc.Timeout, 10*time.Second), svc.FollowRedirects, svc.InsecureSkipVerify).Do(req)
		latency := time.Since(start)
		if err != nil {
			status.Status = "down"
			status.Error = err.Error()
			return status
		}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
		resp.Body.Close()
		status.ResponseSize = int64(len(body))
		status.StatusCode = resp.StatusCode

		if svc.ExpectedStatus > 0 {
			if resp.StatusCode == svc.ExpectedStatus {
				status.Status = "up"
			} else {
				status.Status = "degraded"
			}
		} else if resp.StatusCode >= 200 && resp.StatusCode < 400 {
			status.Status = "up"
		} else {
			status.Status = "degraded"
		}
		status.Latency = fmt.Sprintf("%dms", latency.Milliseconds())

		if host := resp.Request.URL.Hostname(); host != "" {
			status.ResolvedIP = firstResolvedIP(ctx, host)
		}

	case "tcp":
		host, _, err := net.SplitHostPort(svc.URL)
		if err == nil {
			status.ResolvedIP = firstResolvedIP(ctx, host)
		}
		conn, err := dialTCP(ctx, svc.URL, parseTimeout(svc.Timeout, 5*time.Second))
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
