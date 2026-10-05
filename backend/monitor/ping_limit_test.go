package monitor

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pradiptamahardika/homelab-monitor/config"
)

func TestCheckServerHTTPRespectsContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	serverConfig := config.Server{
		Name: "test",
		Host: "127.0.0.1",
		Port: server.Listener.Addr().(*net.TCPAddr).Port,
		Type: "http",
	}

	status := CheckServer(ctx, serverConfig)
	if status.Alive {
		t.Fatalf("expected cancelled request to fail, got alive=true")
	}
}

func TestCheckServiceHTTPUsesLimitReader(t *testing.T) {
	largeBody := strings.Repeat("x", 2*1024*1024) // 2 MB
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(largeBody))
	}))
	defer server.Close()

	serviceConfig := config.Service{
		Name: "test",
		URL:  server.URL,
		Type: "http",
	}

	status := CheckService(context.Background(), serviceConfig)

	// Should not crash and should have a response size capped reasonably
	if status.Status != "up" {
		t.Fatalf("expected up, got %s: %s", status.Status, status.Error)
	}
	if status.ResponseSize > 1024*1024 {
		t.Fatalf("response size should be capped at 1 MB, got %d", status.ResponseSize)
	}
}

func TestCheckServiceHTTPRespectsContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	serviceConfig := config.Service{
		Name: "test",
		URL:  server.URL,
		Type: "http",
	}

	status := CheckService(ctx, serviceConfig)
	if status.Status == "up" {
		t.Fatalf("expected cancelled request to fail, got status=up")
	}
}

func TestCheckServiceExpectedStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	up := CheckService(context.Background(), config.Service{
		Name:           "ok",
		URL:            server.URL,
		Type:           "http",
		ExpectedStatus: 200,
	})
	if up.Status != "up" {
		t.Fatalf("expected up, got %s", up.Status)
	}

	down := CheckService(context.Background(), config.Service{
		Name:           "mismatch",
		URL:            server.URL,
		Type:           "http",
		ExpectedStatus: 404,
	})
	if down.Status != "degraded" {
		t.Fatalf("expected degraded for mismatched status, got %s", down.Status)
	}
}

func TestCheckServiceFollowRedirectsDisabled(t *testing.T) {
	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/target" {
			w.WriteHeader(http.StatusOK)
			return
		}
		http.Redirect(w, r, "/target", http.StatusFound)
	}))
	defer redirector.Close()

	noFollow := CheckService(context.Background(), config.Service{
		Name:            "no-follow",
		URL:             redirector.URL + "/start",
		Type:            "http",
		FollowRedirects: false,
	})
	if noFollow.StatusCode != http.StatusFound {
		t.Fatalf("expected 302 when not following, got %d", noFollow.StatusCode)
	}

	follow := CheckService(context.Background(), config.Service{
		Name:            "follow",
		URL:             redirector.URL + "/start",
		Type:            "http",
		FollowRedirects: true,
	})
	if follow.Status != "up" {
		t.Fatalf("expected up when following redirect, got %s", follow.Status)
	}
}

func TestCheckServiceInsecureSkipVerify(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Without insecure_skip_verify the self-signed cert fails.
	strict := CheckService(context.Background(), config.Service{
		Name: "strict",
		URL:  server.URL,
		Type: "http",
	})
	if strict.Status == "up" {
		t.Fatalf("expected self-signed cert to fail without insecure_skip_verify")
	}

	// With insecure_skip_verify the self-signed cert is accepted.
	loose := CheckService(context.Background(), config.Service{
		Name:               "loose",
		URL:                server.URL,
		Type:               "http",
		InsecureSkipVerify: true,
	})
	if loose.Status != "up" {
		t.Fatalf("expected up with insecure_skip_verify, got %s: %s", loose.Status, loose.Error)
	}
}

func TestCheckServiceTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	status := CheckService(context.Background(), config.Service{
		Name:    "slow",
		URL:     server.URL,
		Type:    "http",
		Timeout: "50ms",
	})
	if status.Status == "up" {
		t.Fatalf("expected slow service to time out, got up")
	}
}

func TestIsTailnetHost(t *testing.T) {
	cases := map[string]bool{
		"umbrel-7070.flamingo-justitia.ts.net":  true,
		"UMBREL-7070.FLAMINGO-JUSTITIA.TS.NET":  true,
		"umbrel-7070.flamingo-justitia.ts.net.": true,
		"p15-wsl.flamingo-justitia.ts.net":      true,
		"uptimekuma.diptamahardhika.cloud":      false,
		"example.com":                           false,
		"host.docker.internal":                  false,
		"ts.net":                                false,
		"notts.net.evil.com":                    false,
		"":                                      false,
	}
	for host, want := range cases {
		if got := isTailnetHost(host); got != want {
			t.Errorf("isTailnetHost(%q) = %v, want %v", host, got, want)
		}
	}
}

func TestResolveTailnetHostSkipsNonTailnetNames(t *testing.T) {
	// A non-tailnet host must never hit the MagicDNS resolver, so this stays
	// fast and works on machines without Tailscale installed.
	if ip := resolveTailnetHost(context.Background(), "example.com"); ip != "" {
		t.Fatalf("expected no MagicDNS lookup for example.com, got %s", ip)
	}
	if ip := resolveTailnetHost(context.Background(), "host.docker.internal"); ip != "" {
		t.Fatalf("expected no MagicDNS lookup for host.docker.internal, got %s", ip)
	}
}

// TestMagicDNSFallsBackGracefully pins the fallback contract: when MagicDNS is
// unreachable (no Tailscale, or the resolver is blocked), checks must still run
// through normal DNS instead of erroring out.
func TestMagicDNSFallsBackGracefully(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	ip := resolveTailnetHost(ctx, "definitely-not-a-real-host.flamingo-justitia.ts.net")
	if ip != "" {
		t.Fatalf("expected empty resolution for nonexistent host, got %s", ip)
	}
}

func TestCheckServiceTCPUsesResolvedHost(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			conn.Close()
		}
	}()

	port := listener.Addr().(*net.TCPAddr).Port
	status := CheckService(context.Background(), config.Service{
		Name: "tcp",
		URL:  fmt.Sprintf("127.0.0.1:%d", port),
		Type: "tcp",
	})
	if status.Status != "up" {
		t.Fatalf("expected tcp service up, got %s: %s", status.Status, status.Error)
	}
	if status.ResolvedIP == "" {
		t.Fatal("expected ResolvedIP to be populated for tcp service")
	}
}

func TestParseTimeout(t *testing.T) {
	if d := parseTimeout("", time.Second); d != time.Second {
		t.Fatalf("empty should fall back to default, got %s", d)
	}
	if d := parseTimeout("bogus", time.Second); d != time.Second {
		t.Fatalf("malformed should fall back to default, got %s", d)
	}
	if d := parseTimeout("2s", time.Second); d != 2*time.Second {
		t.Fatalf("expected 2s, got %s", d)
	}
}
