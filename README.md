# HomeLab Monitor

A lightweight, self-hosted dashboard to monitor your servers, services, and Docker containers — all behind a clean, modern web UI.

## Quick Start

```bash
docker compose up -d
```

Open http://localhost:9876

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

- `tcp` — TCP port reachability check
- `http` — HTTP status code check (200-399 = up)

## Docker Socket

The container needs access to the Docker socket to list containers:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

## Development

```bash
# Terminal 1: Backend
cd backend && go run .

# Terminal 2: Frontend
cd frontend && npm install && npm run dev
```

The Vite dev server proxies `/api` requests to the Go backend.

## Build from source

```bash
docker build -t homelab-monitor .
docker run -p 9876:9876 -v /var/run/docker.sock:/var/run/docker.sock:ro -v ./config.yaml:/app/config.yaml:ro homelab-monitor
```
