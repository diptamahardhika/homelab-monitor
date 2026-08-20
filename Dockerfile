# ---- Frontend build ----
FROM node:24-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Go build ----
FROM golang:1.25-alpine AS backend
WORKDIR /build
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
ARG VERSION=dev
ARG COMMIT=
ARG COMMIT_TIME=
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-X github.com/pradiptamahardika/homelab-monitor/handlers.Version=${VERSION} -X github.com/pradiptamahardika/homelab-monitor/handlers.Commit=${COMMIT} -X github.com/pradiptamahardika/homelab-monitor/handlers.CommitTime=${COMMIT_TIME}" -o /app/homelab-monitor .

# ---- Runtime ----
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

RUN mkdir -p /app/data

COPY --from=backend /app/homelab-monitor .
COPY --from=frontend /build/dist ./static
COPY config.yaml /app/config.yaml

EXPOSE 9876

# /api/health stays unauthenticated (see main.go) so it works for healthchecks.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:9876/api/health || exit 1

CMD ["./homelab-monitor"]
