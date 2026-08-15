# HomeLab Monitor

A lightweight, self-hosted dashboard to monitor your servers, services, and Docker containers — all behind a clean, modern web UI.

Built with a **Go** backend and a **React + Vite** frontend styled with **Tailwind CSS**.

## Features

- **Server monitoring** — TCP port reachability checks with configurable timeouts, expected status codes, and redirect handling
- **Service monitoring** — HTTP health check endpoints (200-399 = up) with response size limiting (1 MB cap), TLS verification options, and numeric latency tracking
- **Docker container monitoring** — real-time container status, logs, and stats via the Docker socket
- **System resource monitoring** — real-time CPU, memory, and disk usage
- **Latency sparklines** — time-series latency history for every server and service (numeric + formatted)
- **Attention-first dashboard** — critical issues (down services, unhealthy containers, high resource usage) surfaced at the top
- **Service dependency map** — visual graph with cycle detection; add/remove dependencies from the UI
- **Configuration UI** — edit servers, services, and port directly from the dashboard (no SSH required)
- **Container log viewer** — stream logs with auto-refresh, configurable tail lines, stderr/stdout colorization
- **Custom dashboard layouts** — drag-drop section reordering, show/hide sections, persists to localStorage
- **Improved empty states** — illustrated guidance for adding your first servers, services, and Docker
- **REST API** — full CRUD for services, config, dependencies, and container logs
- **Concurrent, bounded monitoring** — in-memory scheduler with coalesced refreshes and graceful context cancellation
- **Single binary** — everything packaged into a multi-arch Docker image (amd64/arm64)

## Project Structure

```
homelab-monitor/
├── backend/           # Go API server
│   ├── main.go        # entry point, router, static file server
│   ├── config/        # YAML config loader (with Save support)
│   ├── handlers/      # HTTP handlers (health, servers, services, docker, config, dependencies)
│   ├── monitor/       # monitoring logic (TCP ping, HTTP check, Docker client, logs)
│   └── dependencies/  # dependency graph store with cycle detection
├── frontend/          # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx        # main dashboard with AttentionBanner
│   │   │   ├── ConfigEditor.jsx     # configuration UI
│   │   │   ├── ContainerLogViewer.jsx  # log streaming
│   │   │   ├── DependencyMap.jsx    # visual dependency graph
│   │   │   └── LayoutEditor.jsx     # drag-drop layout editor
│   │   ├── refresh.mjs              # visibility-aware refresh intervals
│   │   └── ...
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
| `expected_status` | services | 0 (any 2xx/3xx) | Specific HTTP status to expect |
| `follow_redirects` | services | `false` | Follow HTTP redirects |
| `insecure_skip_verify` | services | `false` | Skip TLS certificate verification |

**You can now edit all of the above directly from the dashboard Configuration UI (gear icon in toolbar).**

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend health check |
| GET | `/api/overview` | Cached snapshot of all dashboard data |
| GET | `/api/servers` | List all configured servers |
| GET | `/api/services` | List monitored services |
| POST | `/api/services` | Add a service (JSON body) |
| DELETE | `/api/services/{name}` | Remove a service |
| GET | `/api/docker` | List all Docker containers |
| GET | `/api/docker/{id}` | Container details and stats |
| GET | `/api/docker/{id}/logs` | Container logs (query: `?tail=N`, default 100) |
| GET | `/api/system` | Host system stats (CPU, memory, disk) |
| GET | `/api/config` | Load current config (servers, services, port) |
| PUT | `/api/config` | Update & persist config.yaml |
| GET | `/api/dependencies` | List all service dependencies |
| POST | `/api/dependencies` | Add dependency (`{from, to}`) with cycle detection |
| DELETE | `/api/dependencies` | Remove dependency (`?from=X&to=Y`) |

### Service Management (POST /api/services)

```json
{
  "name": "My Service",
  "url": "https://api.example.com/health",
  "type": "http"
}
```

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

- Go 1.21+
- Node.js 20+
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

# Frontend tests
cd frontend && node --test src/refresh.test.mjs
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
| `CONFIG_PATH` | `/app/config.yaml` | Path to the configuration file |
| `STATIC_DIR` | `/app/static` | Path to the frontend static files |
| `DATA_PATH` | `/app/data/extra_services.json` | Path to persist UI-added services |

## Dashboard Toolbar

The header includes quick-access buttons:

| Icon | Feature | Description |
|------|---------|-------------|
| ⚙️ | **Configuration** | Edit servers, services, port |
| 📊 | **Dependencies** | Visual service dependency map |
| 📦 | **Layout** | Drag-drop section reordering |
| 🔄 | **Refresh** | Manual data refresh |
| 🌙/☀️ | **Theme** | Toggle dark/light mode |

## Attention Banner

When issues are detected (down services, unhealthy containers, CPU/memory/disk > 90%), a red banner appears at the top with clickable alert chips and quick-action buttons.
