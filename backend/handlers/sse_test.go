package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pradiptamahardika/homelab-monitor/config"
)

func TestSSEHubBroadcast(t *testing.T) {
	hub := newSSEHub()
	ch := hub.subscribe()
	defer hub.unsubscribe(ch)

	hub.broadcast([]byte("one"))
	select {
	case got := <-ch:
		if string(got) != "one" {
			t.Fatalf("got %q; want %q", got, "one")
		}
	case <-time.After(time.Second):
		t.Fatal("no broadcast received")
	}

	// A full buffer must not block the broadcaster.
	for i := 0; i < 20; i++ {
		hub.broadcast([]byte("x"))
	}
}

func TestEventsStreamsSnapshot(t *testing.T) {
	h := New(&config.Config{Port: 9876}, t.TempDir()+"/services.json")
	if err := h.cache.Refresh(context.Background()); err != nil {
		t.Fatalf("refresh: %v", err)
	}

	// Cancelled context: handler writes the initial snapshot, then exits.
	cctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/events", nil).WithContext(cctx)
	rec := httptest.NewRecorder()

	h.Events(rec, req)

	if ct := rec.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("Content-Type = %q; want text/event-stream", ct)
	}
	body := rec.Body.String()
	if !contains(body, "data: ") {
		t.Fatalf("expected SSE data line, got %q", body)
	}
	for _, key := range []string{"\"overview\"", "\"history\""} {
		if !contains(body, key) {
			t.Fatalf("SSE payload missing %s: %s", key, body)
		}
	}
}

func TestEventsOnNoSnapshot(t *testing.T) {
	h := New(&config.Config{Port: 9876}, t.TempDir()+"/services.json")
	// No refresh performed -> no cached snapshot; handler should exit cleanly
	// on a cancelled context without writing anything.
	cctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/events", nil).WithContext(cctx)
	rec := httptest.NewRecorder()

	h.Events(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want %d", rec.Code, http.StatusOK)
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("expected empty body, got %q", rec.Body.String())
	}
}