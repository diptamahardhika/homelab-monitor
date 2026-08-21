package handlers

import (
	"testing"
	"time"

	"github.com/pradiptamahardika/homelab-monitor/config"
)

func TestRefreshIntervalFromEnv(t *testing.T) {
	cases := []struct {
		name string
		val  string
		want time.Duration
	}{
		{"unset uses default", "", defaultRefreshInterval},
		{"one second", "1s", time.Second},
		{"sub-second allowed to floor", "200ms", 500 * time.Millisecond},
		{"exactly floor", "500ms", 500 * time.Millisecond},
		{"clamped to ceiling", "5m", time.Minute},
		{"unparsable uses default", "fast", defaultRefreshInterval},
		{"whitespace trimmed", "  2s  ", 2 * time.Second},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.val == "" {
				t.Setenv("REFRESH_INTERVAL", "")
			} else {
				t.Setenv("REFRESH_INTERVAL", tc.val)
			}
			if got := refreshIntervalFromEnv(); got != tc.want {
				t.Errorf("refreshIntervalFromEnv(%q) = %v, want %v", tc.val, got, tc.want)
			}
		})
	}
}

// TestNewUsesEnvRefreshInterval proves the env var reaches the live cache,
// not just the parser helper.
func TestNewUsesEnvRefreshInterval(t *testing.T) {
	t.Setenv("REFRESH_INTERVAL", "1s")
	h := New(&config.Config{}, t.TempDir()+"/extra_services.json")
	if got := h.cache.Interval(); got != time.Second {
		t.Errorf("cache interval = %v, want 1s", got)
	}
}
