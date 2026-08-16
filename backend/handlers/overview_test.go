package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pradiptamahardika/homelab-monitor/config"
)

func TestOverviewReturnsMonitoringSnapshot(t *testing.T) {
	h := New(&config.Config{Port: 9876}, t.TempDir()+"/services.json")
	req := httptest.NewRequest(http.MethodGet, "/api/overview", nil)
	rec := httptest.NewRecorder()

	h.Overview(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want %d", rec.Code, http.StatusOK)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q; want application/json", got)
	}
	body := rec.Body.String()
	for _, key := range []string{"\"servers\"", "\"services\"", "\"containers\"", "\"system\"", "\"checked_at\""} {
		if !contains(body, key) {
			t.Fatalf("overview response missing %s: %s", key, body)
		}
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
