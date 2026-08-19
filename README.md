# HomeLab Monitor

A lightweight, self-hosted dashboard to monitor your servers, services, and Docker containers — all behind a clean, modern web UI.

Built with a **Go** backend and a **React + Vite** frontend styled with **Tailwind CSS**.

## Features

- **Server monitoring** — TCP port reachability checks with configurable timeouts, expected status codes, and redirect handling
- **Service monitoring** — HTTP health check endpoints (200-399 = up) with response size limiting (1 MB cap), TLS verification options, and numeric latency tracking
- **Docker container monitoring** — real-time container status and per-container stats (CPU, memory, network) via the Docker socket
- **System resource monitoring** — real-time CPU, memory, and disk usage
- **Latency sparklines & trends** — time-series latency history for every server and service with min/avg/max and up/down trend arrows
- **Uptime history** — rolling uptime percentage per server/service (default 300 samples) persisted to disk so it survives restarts
- **Webhook alerting** — fires a webhook only when a server/service transitions up↔down (no spam on every poll); works with Discord/Slack webhooks
- **Detail panel** — click any server, service, container, or the system stat card to open a slide-over with full details (close with ✕, backdrop click, or **Esc**)
- **Search & sort** — filter services and containers by name, and sort columns by name, status, or latency
- **Service & server management UI** — add, edit, and delete services and servers directly from the dashboard (no SSH required) with in-row delete confirmation and toast feedback
- **Config export/import** — export the full config (servers, services, dependencies) as JSON and import it back to restore or migrate setups, via the header config menu
- **Copy-to-clipboard** — one-click copy for hostnames, URLs, IDs, and other values
- **Live updates** — near-real-time updates pushed over Server-Sent Events (`/api/events`), with a polling fallback and a "last updated" indicator; pauses automatically when the tab is hidden
- **Dark / light theme** — toggle with persisted preference (respects system preference by default)
- **Per-section empty states** — helpful guidance when nothing is configured yet, plus search no-results states
- **REST API** — full CRUD for services, config, and dependencies, plus uptime history
- **Fast by default** — cached `/api/overview` snapshot with stale-while-revalidate serving, coalesced refreshes, shared HTTP/Docker clients, gzip compression, and long-lived immutable caching of hashed static assets
- **Concurrent, bounded monitoring** — in-memory scheduler with a concurrency limit (6) and graceful context cancellation
- **Single binary** — everything packaged into a single Docker image

## Project Structure

```
homelab-monitor/
├── backend/           # Go API server
│   ├── main.go        # entry point, router, static file server
│   ├── config/        # YAML config loader (with Save support)
│   ├── handlers/      # HTTP handlers (overview, health, servers, services, docker, config, dependencies, history)
│   ├── monitor/       # monitoring logic (TCP ping, HTTP check, Docker client, system stats, history, alerting, caching)
│   └── dependencies/  # dependency graph store with cycle detection
├── frontend/          # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   └── Dashboard.jsx   # entire dashboard UI (detail panel, add/edit service modal, toasts)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .github/workflows/ # CI — builds & pushes image to GHCR
├── config.yaml        # user configuration
├── Dockerfile         # multi-stage build (frontend → Go → alpine runtime)
├── docker-compose.yml # one-command deploy
└── README.md
```

## Quick Start (recommended)

```bash
docker run -d \
  --name homelab-monitor \
  -p 9876:9876 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/diptamahardhika/homelab-monitor:latest
```

Open **http://localhost:9876** (production) or **http://localhost:5173** (development)

### Portainer (docker-compose stack)

Paste this into the Portainer stack editor:

```yaml
services:
  monitor:
    image: ghcr.io/diptamahardhika/homelab-monitor:latest
    container_name: homelab-monitor
    ports:
      - "9876:9876"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - homelab-monitor-data:/app/data
    restart: unless-stopped

volumes:
  homelab-monitor-data:
```

> **Important:** The `homelab-monitor-data` volume persists services you add via the UI. Without it, all added services are lost when the container is recreated.

## Configuration

The image ships with a default `config.yaml` so it works out of the box. To customize, mount your own:

```yaml
volumes:
  - ./config.yaml:/app/config.yaml:ro
```

Edit `config.yaml` to define which servers and services to monitor:

```yaml
port: 9876

servers:
  - name: My Server
    host: 192.168.1.100
    port: 22
    type: tcp
    gateway: ""           # "docker" to use Docker bridge gateway
    timeout: 5s           # check timeout (default: 5s)
    expected_status: 0    # ignored for TCP
    follow_redirects: false
    insecure_skip_verify: false

services:
  - name: My App
    url: http://192.168.1.100:3000/health
    type: http
    timeout: 10s          # check timeout (default: 10s)
    expected_status: 200  # expected HTTP status (default: any 2xx/3xx)
    follow_redirects: false
    insecure_skip_verify: false
```

### Check Types

| Type  | Description                        |
|-------|------------------------------------|
| `tcp` | TCP port reachability check        |
| `http`| HTTP status code check (200-399 up)|

### Server/Service Check Parameters

| Parameter | Applies To | Default | Description |
|-----------|------------|---------|-------------|
| `timeout` | both | 5s (servers), 10s (services) | Maximum time to wait for check |
| `gateway` | servers | "" | Set to `"docker"` to use Docker bridge gateway IP |
| `expected_status` | both (HTTP) | 0 (any 2xx/3xx) | Specific HTTP status to expect |
| `follow_redirects` | both (HTTP) | `false` | Follow HTTP redirects |
| `insecure_skip_verify` | both (HTTP) | `false` | Skip TLS certificate verification |

Servers and services can also be added, edited, and deleted directly from the dashboard — no config file editing required. UI-added servers/services are persisted in `DATA_PATH` (`extra_servers.json` / `extra_services.json`), and edits/deletes to config-defined items are persisted to `<DATA_PATH dir>/config.yaml`. Both survive container restarts and rebuilds.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend health check |
| GET | `/api/version` | Build version (set at build time via `-ldflags`) |
| GET | `/api/overview` | Cached snapshot of all dashboard data (stale-while-revalidate) |
| GET | `/api/servers` | List all configured servers |
| POST | `/api/servers` | Add a server (JSON body) |
| PUT | `/api/servers/{name}` | Update an existing server |
| DELETE | `/api/servers/{name}` | Remove a server |
| GET | `/api/services` | List monitored services |
| POST | `/api/services` | Add a service (JSON body) |
| PUT | `/api/services/{name}` | Update an existing service |
| DELETE | `/api/services/{name}` | Remove a service |
| GET | `/api/docker` | List all Docker containers |
| GET | `/api/docker/{id}` | Container details, stats, mounts, and environment |
| GET | `/api/system` | Host system stats (CPU, memory, disk) |
| GET | `/api/config` | Load current config (servers, services, port) |
| PUT | `/api/config` | Update & persist config.yaml |
| GET | `/api/export` | Export full config as JSON (servers, services, dependencies) |
| POST | `/api/import` | Import & replace full config from JSON |
| GET | `/api/dependencies` | List all service dependencies |
| POST | `/api/dependencies` | Add dependency (`{from, to}`) with cycle detection |
| DELETE | `/api/dependencies` | Remove dependency (`?from=X&to=Y`) |
| GET | `/api/history` | Uptime stats for every tracked server and service |
| GET | `/api/events` | Server-Sent Events stream of `{overview, history}` updates pushed on every refresh (drives the live dashboard) |

### Service Management (POST /api/services)

```json
{
  "name": "My Service",
  "url": "https://api.example.com/health",
  "type": "http"
}
```

Services added via the UI are persisted to `DATA_PATH` (`extra_services.json`) and survive container restarts. Edits/deletes of services defined in `config.yaml` are persisted to `<DATA_PATH dir>/config.yaml` and survive container rebuilds too.

### Server Management (POST /api/servers)

```json
{
  "name": "My Server",
  "host": "192.168.1.100",
  "port": 22,
  "type": "tcp",
  "gateway": ""
}
```

Servers added via the UI are persisted to `DATA_PATH` (`extra_servers.json`) and survive container restarts. Edits/deletes of servers defined in `config.yaml` are persisted to `<DATA_PATH dir>/config.yaml` and survive container rebuilds too.

### Dependency Management (POST /api/dependencies)

```json
{
  "from": "api-service",
  "to": "database"
}
```

> The dependency graph prevents cycles — attempting to create a circular dependency returns a 400 error.

## Docker Socket

The container requires access to the Docker socket to list containers:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

## Development

### Prerequisites

- Go 1.25+
- Node.js 24+
- Docker (optional, for containerized runs)

### Backend

```bash
cd backend && go run .
```

The Go API server runs on `http://localhost:9876`.

### Frontend

```bash
cd frontend && npm install && npm run dev
```

The Vite dev server runs the web UI on **http://localhost:5173** and proxies `/api` requests to the Go backend at `http://localhost:9876`.

### Run Tests

```bash
# Backend tests
cd backend && go test ./...
```

## Build from Source

```bash
docker build -t homelab-monitor .
docker run -p 9876:9876 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v ./config.yaml:/app/config.yaml:ro \
  homelab-monitor
```

## Pre-built Images

Images are published automatically to **GHCR**:

```
ghcr.io/diptamahardhika/homelab-monitor:latest
ghcr.io/diptamahardhika/homelab-monitor:v0.1.0
```

Every push to `master` builds a new `latest` image for `linux/amd64` and `linux/arm64`. Tagged releases (`v*`) are also published with semver tags.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONFIG_PATH` | `/app/config.yaml` | Path to the seed configuration file |
| `STATIC_DIR` | `/app/static` | Path to the frontend static files |
| `DATA_PATH` | `/app/data/extra_services.json` | Path to persist UI-added services; a runtime `config.yaml` in the same directory holds UI edits to config-defined items |
| `ALERT_WEBHOOK_URL` | (empty) | Webhook URL to receive up/down alerts (Discord/Slack compatible) |
| `AUTH_TOKEN` | (empty) | Shared access token that locks the dashboard behind a single passphrase. Empty = auth disabled |

## Authentication

By default the dashboard is wide open. To lock it down, set a single shared token via the `AUTH_TOKEN` environment variable — no username, no user store, no signup flow. Anyone with the token has full dashboard access.

### Generate a token

Run one of these to create a strong random value:

```bash
openssl rand -hex 32
# or
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Example output: `3f8a2c1b7d9e4f5a6b8c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a`

### Set it up

**Docker run:**

```bash
docker run -d \
  --name homelab-monitor \
  -p 9876:9876 \
  -e AUTH_TOKEN=3f8a2c1b7d9e4f5a6b8c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/diptamahardhika/homelab-monitor:latest
```

**Docker Compose** (keep the token in a gitignored `.env` file):

```bash
# .env  (already in .gitignore)
AUTH_TOKEN=3f8a2c1b7d9e4f5a6b8c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a
```

Then `docker compose up -d`. The compose file already passes `AUTH_TOKEN: ${AUTH_TOKEN:-}` through.

### Using it

- **Browser** — load the dashboard, paste the token once into the unlock screen; your browser remembers it (via `localStorage`) until you click the 🔒 Lock button in the header.
- **curl / scripts** — send it as a bearer header or query param:

  ```bash
  curl -H "Authorization: Bearer 3f8a2c1b..." http://localhost:9876/api/overview
  curl "http://localhost:9876/api/overview?token=3f8a2c1b..."
  ```

### Lost your token?

There's no recovery — generate a new one, update `AUTH_TOKEN`, and restart the container. **All your data is untouched** (servers, services, dependencies, uptime history are persisted separately in the `DATA_PATH` volume); the dashboard is simply locked until you enter a valid token again.

> **Note:** the token travels over plain HTTP. On a home LAN this is usually fine, but if you expose the dashboard beyond your network, put a TLS reverse proxy (Caddy/Traefik) in front of it. `/api/health` stays unauthenticated so Docker HEALTHCHECKs and uptime bots keep working.

## Dashboard

The dashboard gives you an at-a-glance view of your infrastructure:

- **Stat cards** — servers up/total, services up/total, running containers/total, and system CPU% (click System to open its detail panel)
- **Status banner** — "All systems operational" when everything is healthy, or a red banner listing active incidents; a neutral hint when nothing is configured yet
- **Servers** — card per server with host:port, latency, trend arrow, and reachability dot; add, edit, and delete (with confirmation) right from the section
- **Services** — sortable table with name, status badge, status code, latency, and uptime %; search, add, edit, and delete (with confirmation) right from the section
- **Docker Containers** — sortable table with name, state, status text, and ports; searchable; container ports show clickable **http/https** links so you can jump straight to a service running in a container
- **Detail panel** — click any item to open a slide-over with full details: uptime percentage, latency sparkline (min/avg/max), resolved IP, response size, container performance stats, mounts, and environment variables. Close with the ✕ button, clicking the backdrop, or pressing **Esc**.
- **Header** — theme toggle (dark/light), config menu (export/import JSON), a 🔒 lock button (clears the stored token, shown when `AUTH_TOKEN` is set), manual refresh button with loading state, and a live "last updated" indicator
- **Footer** — build version shown at the bottom (e.g. `v0.1.0`, injected at build time)

## Alerting

Set `ALERT_WEBHOOK_URL` to a Discord or Slack-style webhook to get notified when a server or service goes down or comes back up. Alerts fire only on **status transitions** (up↔down), not on every poll, and the first observation after startup is treated as a baseline (no alert on boot). The payload includes both `content` (Discord) and `text` (Slack/generic) fields so the same URL works across providers.

```
🔴 [service] My App is DOWN — connection refused
🟢 [server] Localhost is back UP
```
