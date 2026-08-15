package monitor

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/diptamahardhika/homelab-monitor/backend/config"
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
		Timeout: 100 * time.Millisecond,
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
		Name:   "test",
		URL:    server.URL,
		Type:   "http",
		Timeout: 5 * time.Second,
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
		Name:   "test",
		URL:    server.URL,
		Type:   "http",
		Timeout: 100 * time.Millisecond,
	}

	status := CheckService(ctx, serviceConfig)
	if status.Status == "up" {
		t.Fatalf("expected cancelled request to fail, got status=up")
	}
}