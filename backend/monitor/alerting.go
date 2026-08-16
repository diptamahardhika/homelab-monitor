package monitor

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// AlertTarget is one monitored item whose up/down state we watch.
type AlertTarget struct {
	Key    string // stable id, e.g. "server:Localhost"
	Name   string
	Kind   string // "server" | "service"
	Up     bool
	Detail string // error text when down
}

// AlertManager fires a webhook only when an item transitions up<->down,
// so it does not spam on every poll. Set ALERT_WEBHOOK_URL to enable.
type AlertManager struct {
	webhookURL string
	client     *http.Client

	mu   sync.Mutex
	prev map[string]bool // key -> was up on last observation
}

func NewAlertManager() *AlertManager {
	return &AlertManager{
		webhookURL: os.Getenv("ALERT_WEBHOOK_URL"),
		client:     &http.Client{Timeout: 10 * time.Second},
		prev:       make(map[string]bool),
	}
}

// Process records current state and sends alerts on transitions.
// The first time a key is seen it is recorded silently (no alert on startup).
func (a *AlertManager) Process(items []AlertTarget) {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, it := range items {
		wasUp, seen := a.prev[it.Key]
		a.prev[it.Key] = it.Up
		if !seen {
			continue // first observation: establish baseline, no alert
		}
		if it.Up == wasUp {
			continue // no change
		}

		if !it.Up {
			a.send(it, false)
		} else {
			a.send(it, true)
		}
	}
}

func (a *AlertManager) send(it AlertTarget, recovered bool) {
	if a.webhookURL == "" {
		return
	}

	emoji := "🟢"
	verb := "is back UP"
	if !recovered {
		emoji = "🔴"
		verb = "is DOWN"
	}
	msg := emoji + " [" + it.Kind + "] " + it.Name + " " + verb
	if !recovered && it.Detail != "" {
		msg += " — " + it.Detail
	}

	// Send both `content` (Discord) and `text` (Slack/generic) so the same
	// webhook works across common providers without extra config.
	body, _ := json.Marshal(map[string]string{
		"content": msg,
		"text":    msg,
	})

	req, err := http.NewRequest(http.MethodPost, a.webhookURL, bytes.NewReader(body))
	if err != nil {
		log.Printf("alert: build request failed: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		log.Printf("alert: send failed for %s: %v", it.Name, err)
		return
	}
	resp.Body.Close()
}
