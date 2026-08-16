package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/pradiptamahardika/homelab-monitor/config"
)

func TestUpdatingServiceInvalidatesMonitoringSnapshot(t *testing.T) {
	h := New(&config.Config{Port: 9876}, t.TempDir()+"/services.json")

	addReq := httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewBufferString(`{"name":"OldName","url":"http://127.0.0.1:1","type":"http"}`))
	addReq.Header.Set("Content-Type", "application/json")
	addRec := httptest.NewRecorder()
	h.AddService(addRec, addReq)
	if addRec.Code != http.StatusCreated {
		t.Fatalf("add service status = %d; want %d", addRec.Code, http.StatusCreated)
	}

	updateReq := httptest.NewRequest(http.MethodPut, "/api/services/OldName", bytes.NewBufferString(`{"name":"NewName","url":"http://127.0.0.1:2","type":"http"}`))
	updateReq.Header.Set("Content-Type", "application/json")
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("name", "OldName")
	updateReq = updateReq.WithContext(context.WithValue(updateReq.Context(), chi.RouteCtxKey, routeContext))
	updateRec := httptest.NewRecorder()
	h.UpdateService(updateRec, updateReq)
	if updateRec.Code != http.StatusOK {
		t.Fatalf("update service status = %d; want %d (body=%s)", updateRec.Code, http.StatusOK, updateRec.Body.String())
	}

	after := h.currentOverview(context.Background())
	if len(after.Services) != 1 {
		t.Fatalf("services after update = %d; want 1", len(after.Services))
	}
	if after.Services[0].Name != "NewName" || after.Services[0].URL != "http://127.0.0.1:2" {
		t.Fatalf("service after update = %#v; want renamed service", after.Services[0])
	}

	notFoundReq := httptest.NewRequest(http.MethodPut, "/api/services/OldName", bytes.NewBufferString(`{"name":"X","url":"http://127.0.0.1:3","type":"http"}`))
	notFoundReq.Header.Set("Content-Type", "application/json")
	notFoundCtx := chi.NewRouteContext()
	notFoundCtx.URLParams.Add("name", "OldName")
	notFoundReq = notFoundReq.WithContext(context.WithValue(notFoundReq.Context(), chi.RouteCtxKey, notFoundCtx))
	notFoundRec := httptest.NewRecorder()
	h.UpdateService(notFoundRec, notFoundReq)
	if notFoundRec.Code != http.StatusNotFound {
		t.Fatalf("update missing service status = %d; want %d", notFoundRec.Code, http.StatusNotFound)
	}
}

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
