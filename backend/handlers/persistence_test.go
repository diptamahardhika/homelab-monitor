package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/pradiptamahardika/homelab-monitor/config"
)

// TestConfigServerEditSurvivesRestart verifies that editing a server defined in
// the seed config persists to the data directory and is reloaded when a fresh
// Handler is created (container rebuild / restart).
func TestConfigServerEditSurvivesRestart(t *testing.T) {
	dataPath := t.TempDir() + "/extra_services.json"
	seed := &config.Config{Port: 9876, Servers: []config.Server{
		{Name: "Localhost", Host: "host.docker.internal", Port: 22, Type: "tcp"},
	}}

	h := New(seed, dataPath)

	updateReq := httptest.NewRequest(http.MethodPut, "/api/servers/Localhost",
		bytes.NewBufferString(`{"name":"Localhost","host":"host.docker.internal","port":2222,"type":"tcp"}`))
	updateReq.Header.Set("Content-Type", "application/json")
	rc := chi.NewRouteContext()
	rc.URLParams.Add("name", "Localhost")
	updateReq = updateReq.WithContext(context.WithValue(updateReq.Context(), chi.RouteCtxKey, rc))
	updateRec := httptest.NewRecorder()
	h.UpdateServer(updateRec, updateReq)
	if updateRec.Code != http.StatusOK {
		t.Fatalf("update status = %d; want %d (body=%s)", updateRec.Code, http.StatusOK, updateRec.Body.String())
	}

	// Simulate a restart: fresh seed config, same data dir.
	h2 := New(&config.Config{Port: 9876, Servers: []config.Server{
		{Name: "Localhost", Host: "host.docker.internal", Port: 22, Type: "tcp"},
	}}, dataPath)

	if len(h2.cfg.Servers) != 1 {
		t.Fatalf("servers after restart = %d; want 1", len(h2.cfg.Servers))
	}
	if got := h2.cfg.Servers[0].Port; got != 2222 {
		t.Fatalf("server port after restart = %d; want 2222 (edit lost)", got)
	}
}

// TestConfigServiceEditSurvivesRestart covers the same persistence guarantee for
// services defined in the seed config.
func TestConfigServiceEditSurvivesRestart(t *testing.T) {
	dataPath := t.TempDir() + "/extra_services.json"
	seed := &config.Config{Port: 9876, Services: []config.Service{
		{Name: "Example HTTP", URL: "https://example.com", Type: "http"},
	}}

	h := New(seed, dataPath)

	updateReq := httptest.NewRequest(http.MethodPut, "/api/services/"+url.PathEscape("Example HTTP"),
		bytes.NewBufferString(`{"name":"Example HTTP","url":"https://api.example.com/health","type":"http"}`))
	updateReq.Header.Set("Content-Type", "application/json")
	rc := chi.NewRouteContext()
	rc.URLParams.Add("name", "Example HTTP")
	updateReq = updateReq.WithContext(context.WithValue(updateReq.Context(), chi.RouteCtxKey, rc))
	updateRec := httptest.NewRecorder()
	h.UpdateService(updateRec, updateReq)
	if updateRec.Code != http.StatusOK {
		t.Fatalf("update status = %d; want %d (body=%s)", updateRec.Code, http.StatusOK, updateRec.Body.String())
	}

	h2 := New(&config.Config{Port: 9876, Services: []config.Service{
		{Name: "Example HTTP", URL: "https://example.com", Type: "http"},
	}}, dataPath)

	if len(h2.cfg.Services) != 1 {
		t.Fatalf("services after restart = %d; want 1", len(h2.cfg.Services))
	}
	if got := h2.cfg.Services[0].URL; got != "https://api.example.com/health" {
		t.Fatalf("service URL after restart = %q; want edited URL", got)
	}
}

// TestConfigServerDeleteSurvivesRestart verifies deleting a seed-config server
// persists and stays deleted across a restart.
func TestConfigServerDeleteSurvivesRestart(t *testing.T) {
	dataPath := t.TempDir() + "/extra_services.json"
	seed := &config.Config{Port: 9876, Servers: []config.Server{
		{Name: "Localhost", Host: "host.docker.internal", Port: 22, Type: "tcp"},
		{Name: "Docker Host", Host: "host.docker.internal", Port: 9000, Type: "tcp", Gateway: "docker"},
	}}

	h := New(seed, dataPath)

	delReq := httptest.NewRequest(http.MethodDelete, "/api/servers/Localhost", nil)
	rc := chi.NewRouteContext()
	rc.URLParams.Add("name", "Localhost")
	delReq = delReq.WithContext(context.WithValue(delReq.Context(), chi.RouteCtxKey, rc))
	delRec := httptest.NewRecorder()
	h.DeleteServer(delRec, delReq)
	if delRec.Code != http.StatusOK {
		t.Fatalf("delete status = %d; want %d (body=%s)", delRec.Code, http.StatusOK, delRec.Body.String())
	}

	h2 := New(&config.Config{Port: 9876, Servers: []config.Server{
		{Name: "Localhost", Host: "host.docker.internal", Port: 22, Type: "tcp"},
		{Name: "Docker Host", Host: "host.docker.internal", Port: 9000, Type: "tcp", Gateway: "docker"},
	}}, dataPath)

	if len(h2.cfg.Servers) != 1 || h2.cfg.Servers[0].Name != "Docker Host" {
		t.Fatalf("servers after restart = %#v; want only Docker Host", h2.cfg.Servers)
	}
}
