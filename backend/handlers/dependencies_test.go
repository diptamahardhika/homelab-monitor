package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pradiptamahardika/homelab-monitor/config"
)

// TestReorderDependencies verifies the reorder endpoint persists the new row
// order and that the order survives a restart (fresh Handler on same data dir).
func TestReorderDependencies(t *testing.T) {
	dataPath := t.TempDir() + "/extra_services.json"
	h := New(&config.Config{Port: 9876}, dataPath)

	seed := []byte(`[{"from":"api","to":"db"},{"from":"db","to":"cache"},{"from":"worker","to":"queue"}]`)
	addRec := httptest.NewRecorder()
	h.ReorderDependencies(addRec, httptest.NewRequest(http.MethodPut, "/api/dependencies/order", bytes.NewReader(seed)))
	if addRec.Code != http.StatusOK {
		t.Fatalf("seed reorder status = %d; want %d (body=%s)", addRec.Code, http.StatusOK, addRec.Body.String())
	}

	reversed := []byte(`[{"from":"worker","to":"queue"},{"from":"db","to":"cache"},{"from":"api","to":"db"}]`)
	reorderRec := httptest.NewRecorder()
	h.ReorderDependencies(reorderRec, httptest.NewRequest(http.MethodPut, "/api/dependencies/order", bytes.NewReader(reversed)))
	if reorderRec.Code != http.StatusOK {
		t.Fatalf("reorder status = %d; want %d (body=%s)", reorderRec.Code, http.StatusOK, reorderRec.Body.String())
	}

	getRec := httptest.NewRecorder()
	h.GetDependencies(getRec, httptest.NewRequest(http.MethodGet, "/api/dependencies", nil))
	if getRec.Code != http.StatusOK {
		t.Fatalf("get status = %d; want %d", getRec.Code, http.StatusOK)
	}
	want := `[{"from":"worker","to":"queue"},{"from":"db","to":"cache"},{"from":"api","to":"db"}]`
	if got := getRec.Body.String(); got != want+"\n" {
		t.Fatalf("dependencies after reorder = %s; want %s", got, want)
	}

	// A fresh Handler on the same data dir must load the persisted order.
	h2 := New(&config.Config{Port: 9876}, dataPath)
	getRec2 := httptest.NewRecorder()
	h2.GetDependencies(getRec2, httptest.NewRequest(http.MethodGet, "/api/dependencies", nil))
	if got := getRec2.Body.String(); got != want+"\n" {
		t.Fatalf("dependencies after restart = %s; want %s", got, want)
	}
}

// TestReorderDependenciesRejectsInvalidInput verifies malformed payloads and
// dependency lists that would create cycles are rejected without persisting.
func TestReorderDependenciesRejectsInvalidInput(t *testing.T) {
	dataPath := t.TempDir() + "/extra_services.json"
	h := New(&config.Config{Port: 9876}, dataPath)

	h.ReorderDependencies(httptest.NewRecorder(), httptest.NewRequest(http.MethodPut, "/api/dependencies/order",
		bytes.NewReader([]byte(`not json`))))

	cyclic := []byte(`[{"from":"a","to":"b"},{"from":"b","to":"a"}]`)
	rec := httptest.NewRecorder()
	h.ReorderDependencies(rec, httptest.NewRequest(http.MethodPut, "/api/dependencies/order", bytes.NewReader(cyclic)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("cycle reorder status = %d; want %d", rec.Code, http.StatusBadRequest)
	}

	// Nothing was persisted.
	getRec := httptest.NewRecorder()
	h.GetDependencies(getRec, httptest.NewRequest(http.MethodGet, "/api/dependencies", nil))
	if got := getRec.Body.String(); got != "[]\n" {
		t.Fatalf("dependencies after rejected reorder = %s; want []", got)
	}
}