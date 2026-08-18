package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pradiptamahardika/homelab-monitor/config"
	"github.com/pradiptamahardika/homelab-monitor/dependencies"
)

// TestExportConfigIncludesExtras verifies that export merges the seed config
// with UI-added extras and dependencies.
func TestExportConfigIncludesExtras(t *testing.T) {
	dataPath := t.TempDir() + "/extra_services.json"
	seed := &config.Config{Port: 9876, Servers: []config.Server{
		{Name: "Localhost", Host: "host.docker.internal", Port: 22, Type: "tcp"},
	}}

	h := New(seed, dataPath)

	// Add a UI server + service + dependency.
	addSrv := httptest.NewRequest(http.MethodPost, "/api/servers",
		bytes.NewBufferString(`{"name":"Docker Host","host":"host.docker.internal","port":9000,"type":"tcp","gateway":"docker"}`))
	addSrv.Header.Set("Content-Type", "application/json")
	addSrvRec := httptest.NewRecorder()
	h.AddServer(addSrvRec, addSrv)
	if addSrvRec.Code != http.StatusCreated {
		t.Fatalf("add server status = %d; want %d", addSrvRec.Code, http.StatusCreated)
	}

	h.cfg.Services = []config.Service{{Name: "Example HTTP", URL: "https://example.com", Type: "http"}}
	h.extraServices = append(h.extraServices, config.Service{Name: "UI Service", URL: "https://ui.example.com", Type: "http"})
	if err := h.saveExtraServices(); err != nil {
		t.Fatal(err)
	}
	if err := h.depsStore.Add(dependencies.Dependency{From: "Example HTTP", To: "UI Service"}); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/export", nil)
	rec := httptest.NewRecorder()
	h.ExportConfig(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("export status = %d; want %d (body=%s)", rec.Code, http.StatusOK, rec.Body.String())
	}

	var got ExportConfig
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}

	if got.Version != exportConfigVersion {
		t.Fatalf("version = %d; want %d", got.Version, exportConfigVersion)
	}
	if got.Port != 9876 {
		t.Fatalf("port = %d; want 9876", got.Port)
	}
	if len(got.Servers) != 2 {
		t.Fatalf("servers = %d; want 2 (seed + extra)", len(got.Servers))
	}
	if len(got.Services) != 2 {
		t.Fatalf("services = %d; want 2 (cfg + extra)", len(got.Services))
	}
	if len(got.Dependencies) != 1 || got.Dependencies[0].From != "Example HTTP" {
		t.Fatalf("dependencies = %#v; want [Example HTTP -> UI Service]", got.Dependencies)
	}
}

// TestImportConfigReplaces verifies that import replaces seed config, extras,
// and dependencies, and that the result survives a restart.
func TestImportConfigReplaces(t *testing.T) {
	dataPath := t.TempDir() + "/extra_services.json"
	seed := &config.Config{Port: 9876, Servers: []config.Server{
		{Name: "Old Server", Host: "10.0.0.1", Port: 22, Type: "tcp"},
	}}

	h := New(seed, dataPath)
	h.extraServers = append(h.extraServers, config.Server{Name: "Extra Server", Host: "10.0.0.2", Port: 22, Type: "tcp"})
	if err := h.saveExtraServers(); err != nil {
		t.Fatal(err)
	}

	body := `{
	  "version": 1,
	  "port": 8080,
	  "servers": [
	    {"name":"New Server","host":"192.168.1.50","port":443,"type":"tcp"}
	  ],
	  "services": [
	    {"name":"New Service","url":"https://example.com/health","type":"http"}
	  ],
	  "dependencies": [
	    {"from":"New Service","to":"New Server"}
	  ]
	}`

	req := httptest.NewRequest(http.MethodPost, "/api/import", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ImportConfig(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("import status = %d; want %d (body=%s)", rec.Code, http.StatusOK, rec.Body.String())
	}

	// In-memory state replaced.
	if len(h.cfg.Servers) != 1 || h.cfg.Servers[0].Name != "New Server" {
		t.Fatalf("cfg servers = %#v; want only New Server", h.cfg.Servers)
	}
	if len(h.extraServers) != 0 {
		t.Fatalf("extra servers = %#v; want cleared", h.extraServers)
	}
	if len(h.extraServices) != 0 {
		t.Fatalf("extra services = %#v; want cleared", h.extraServices)
	}
	deps := h.depsStore.GetAll()
	if len(deps) != 1 || deps[0].From != "New Service" {
		t.Fatalf("deps = %#v; want [New Service -> New Server]", deps)
	}

	// Survives restart.
	h2 := New(&config.Config{Port: 9876, Servers: []config.Server{
		{Name: "Old Server", Host: "10.0.0.1", Port: 22, Type: "tcp"},
	}}, dataPath)

	if len(h2.cfg.Servers) != 1 || h2.cfg.Servers[0].Name != "New Server" {
		t.Fatalf("servers after restart = %#v; want New Server", h2.cfg.Servers)
	}
	if len(h2.cfg.Services) != 1 || h2.cfg.Services[0].Name != "New Service" {
		t.Fatalf("services after restart = %#v; want New Service", h2.cfg.Services)
	}
	if h2.cfg.Port != 8080 {
		t.Fatalf("port after restart = %d; want 8080", h2.cfg.Port)
	}
	if len(h2.extraServers) != 0 {
		t.Fatalf("extra servers after restart = %#v; want cleared", h2.extraServers)
	}
	if got := h2.depsStore.GetAll(); len(got) != 1 || got[0].From != "New Service" {
		t.Fatalf("deps after restart = %#v; want [New Service -> New Server]", got)
	}
}

// TestImportConfigRejectsInvalid verifies validation on import.
func TestImportConfigRejectsInvalid(t *testing.T) {
	h := New(&config.Config{Port: 9876}, t.TempDir()+"/extra_services.json")

	cases := []struct {
		name string
		body string
	}{
		{"missing name", `{"version":1,"servers":[{"host":"10.0.0.1","port":22,"type":"tcp"}],"services":[]}`},
		{"bad server type", `{"version":1,"servers":[{"name":"x","host":"10.0.0.1","port":22,"type":"udp"}],"services":[]}`},
		{"self dep", `{"version":1,"servers":[],"services":[{"name":"a","url":"https://a","type":"http"}],"dependencies":[{"from":"a","to":"a"}]}`},
		{"cycle", `{"version":1,"servers":[],"services":[{"name":"a","url":"https://a","type":"http"},{"name":"b","url":"https://b","type":"http"}],"dependencies":[{"from":"a","to":"b"},{"from":"b","to":"a"}]}`},
		{"wrong version", `{"version":99,"servers":[],"services":[]}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/import", bytes.NewBufferString(tc.body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			h.ImportConfig(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d; want 400 (body=%s)", rec.Code, rec.Body.String())
			}
		})
	}
}