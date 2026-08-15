package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/diptamahardhika/homelab-monitor/backend/config"
	"github.com/go-chi/chi/v5"
)

func TestAddingServiceInvalidatesMonitoringSnapshot(t *testing.T) {
	h := New(&config.Config{Port: 9876}, t.TempDir()+"/services.json")
	before := h.currentOverview(context.Background())
	if len(before.Services) != 0 {
		t.Fatalf("initial services = %d; want 0", len(before.Services))
	}

	req := httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewBufferString(`{"name":"Example","url":"http://127.0.0.1:1","type":"http","timeout":10000000000}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.AddService(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("add service status = %d; want %d", rec.Code, http.StatusCreated)
	}

	after := h.currentOverview(context.Background())
	if len(after.Services) != 1 || after.Services[0].Name != "Example" {
		t.Fatalf("services after add = %#v; want the new service", after.Services)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/services/Example", nil)
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("name", "Example")
	deleteReq = deleteReq.WithContext(context.WithValue(deleteReq.Context(), chi.RouteCtxKey, routeContext))
	deleteRec := httptest.NewRecorder()
	h.DeleteService(deleteRec, deleteReq)
	if deleteRec.Code != http.StatusOK {
		t.Fatalf("delete service status = %d; want %d", deleteRec.Code, http.StatusOK)
	}
	if afterDelete := h.currentOverview(context.Background()); len(afterDelete.Services) != 0 {
		t.Fatalf("services after delete = %#v; want none", afterDelete.Services)
	}
}
