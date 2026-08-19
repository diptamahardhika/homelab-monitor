package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func testHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
}

func TestAuthMiddlewareDisabled(t *testing.T) {
	handler := authMiddleware("")(testHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/overview", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 when auth disabled, got %d", rec.Code)
	}
}

func TestAuthMiddlewareMissingToken(t *testing.T) {
	handler := authMiddleware("secret-token")(testHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/overview", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", rec.Code)
	}
}

func TestAuthMiddlewareWrongToken(t *testing.T) {
	handler := authMiddleware("secret-token")(testHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/overview", nil)
	req.Header.Set("Authorization", "Bearer wrong")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with wrong token, got %d", rec.Code)
	}
}

func TestAuthMiddlewareBearerHeader(t *testing.T) {
	handler := authMiddleware("secret-token")(testHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/overview", nil)
	req.Header.Set("Authorization", "Bearer secret-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 with bearer header, got %d", rec.Code)
	}
}

func TestAuthMiddlewareQueryParam(t *testing.T) {
	handler := authMiddleware("secret-token")(testHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/overview?token=secret-token", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 with query param, got %d", rec.Code)
	}
}

func TestAuthMiddlewareCookie(t *testing.T) {
	handler := authMiddleware("secret-token")(testHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/overview", nil)
	req.AddCookie(&http.Cookie{Name: "auth_token", Value: "secret-token"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 with cookie, got %d", rec.Code)
	}
}

func TestAuthMiddlewareConstantTimeRejectsPartialPrefix(t *testing.T) {
	handler := authMiddleware("secret-token")(testHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/overview", nil)
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for prefix token, got %d", rec.Code)
	}
}
