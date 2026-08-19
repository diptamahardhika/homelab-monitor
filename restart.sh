#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE="homelab-monitor:latest"
CONTAINER="homelab-monitor"

# Load .env if present (AUTH_TOKEN etc.)
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

echo "==> Building Docker image from current source..."
docker build -t "$IMAGE" "$PROJECT_DIR"

echo "==> Restarting container..."
docker rm -f "$CONTAINER" 2>/dev/null || true

docker run -d \
  --name "$CONTAINER" \
  -p 9876:9876 \
  -e AUTH_TOKEN="${AUTH_TOKEN:-}" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PROJECT_DIR/data:/app/data" \
  "$IMAGE"

sleep 2

echo "==> Verifying..."
HEALTH=$(curl -s http://localhost:9876/api/health 2>/dev/null)
if [ "$HEALTH" = '{"status":"ok"}' ]; then
  echo "✅ Backend healthy"
else
  echo "❌ Backend not ready: $HEALTH"
  exit 1
fi

TITLE=$(curl -s http://localhost:9876/ 2>/dev/null | grep -o '<title>[^<]*</title>' || echo "")
if [ -n "$TITLE" ]; then
  echo "✅ Frontend serving: $TITLE"
else
  echo "⚠️  Frontend not reachable (container may still be starting)"
fi

echo ""
echo "HomLab Monitor is running at http://localhost:9876"
