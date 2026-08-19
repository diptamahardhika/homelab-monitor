package main

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"strings"
)

// authMiddleware gates requests behind a shared bearer token. When secret is
// empty, auth is disabled and requests pass through untouched.
//
// Tokens are accepted from (in priority order):
//   - Authorization: Bearer <token> header
//   - ?token=<token> query parameter (handy for curl / uptime bots)
//   - auth_token cookie (used by the dashboard once unlocked)
func authMiddleware(secret string) func(http.Handler) http.Handler {
	if secret == "" {
		return func(next http.Handler) http.Handler { return next }
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := r.Header.Get("Authorization")
			if strings.HasPrefix(token, "Bearer ") {
				token = strings.TrimSpace(strings.TrimPrefix(token, "Bearer "))
			} else if q := r.URL.Query().Get("token"); q != "" {
				token = q
			} else if c, err := r.Cookie("auth_token"); err == nil {
				token = c.Value
			}

			if subtle.ConstantTimeCompare([]byte(token), []byte(secret)) != 1 {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
