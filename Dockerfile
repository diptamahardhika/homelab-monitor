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
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-X github.com/pradiptamahardika/homelab-monitor/handlers.Version=${VERSION}" -o /app/homelab-monitor .

# ---- Runtime ----
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

RUN mkdir -p /app/data

COPY --from=backend /app/homelab-monitor .
COPY --from=frontend /build/dist ./static
COPY config.yaml /app/config.yaml

EXPOSE 9876
CMD ["./homelab-monitor"]
