# HomeLab Monitor

A lightweight, self-hosted dashboard to monitor your servers, services, and Docker containers — all behind a clean, modern web UI.

Built with a **Go** backend and a **React + Vite** frontend styled with **Tailwind CSS**.

## Features

- **Server monitoring** — TCP port reachability checks
- **Service monitoring** — HTTP health check endpoints (200-399 = up)
- **Docker container monitoring** — real-time container status, logs, and stats via the Docker socket
- **REST API** — add/remove services on the fly
- **Single binary** — everything packaged into a Docker image

## Project Structure

```
homelab-monitor/
├── backend/           # Go API server
│   ├── main.go        # entry point, router, static file server
│   ├── config/        # YAML config loader
│   ├── handlers/      # HTTP handlers (health, servers, services, docker)
│   └── monitor/       # monitoring logic (TCP ping, HTTP check, Docker client)
├── frontend/          # React + Vite + Tailwind
│   ├── src/           # React components
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── config.yaml        # user configuration
├── Dockerfile         # multi-stage build (frontend → Go → alpine runtime)
├── docker-compose.yml # one-command deploy
└── README.md
```

## Quick Start

```bash
docker compose up -d
```

Open **http://localhost:9876**

## Configuration

Edit `config.yaml` to define which servers and services to monitor:

```yaml
port: 9876

servers:
  - name: My Server
    host: 192.168.1.100
    port: 22
    type: tcp

services:
  - name: My App
    url: http://192.168.1.100:3000/health
    type: http
```

### Check Types

| Type  | Description                        |
|-------|------------------------------------|
| `tcp` | TCP port reachability check        |
| `http`| HTTP status code check (200-399 up)|

## API Endpoints

| Method | Path                  | Description                   |
|--------|-----------------------|-------------------------------|
| GET    | `/api/health`         | Backend health check          |
| GET    | `/api/servers`        | List all configured servers   |
| GET    | `/api/services`       | List monitored services       |
| POST   | `/api/services`       | Add a service (JSON body)     |
| DELETE | `/api/services/{name}`| Remove a service              |
| GET    | `/api/docker`         | List all Docker containers    |
| GET    | `/api/docker/{id}`    | Container details and logs    |

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

### Frontend

```bash
cd frontend && npm install && npm run dev
```

The Vite dev server proxies `/api` requests to the Go backend (default `http://localhost:9876`).

## Build from Source

```bash
docker build -t homelab-monitor .
docker run -p 9876:9876 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v ./config.yaml:/app/config.yaml:ro \
  homelab-monitor
```

## Environment Variables

| Variable      | Default           | Description                      |
|---------------|-------------------|----------------------------------|
| `CONFIG_PATH` | `/app/config.yaml`| Path to the configuration file   |
| `STATIC_DIR`  | `/app/static`     | Path to the frontend static files|
