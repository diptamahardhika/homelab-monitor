package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/diptamahardhika/homelab-monitor/backend/config"
	"github.com/diptamahardhika/homelab-monitor/backend/handlers"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "/app/config.yaml"
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	dataPath := os.Getenv("DATA_PATH")
	if dataPath == "" {
		dataPath = "/app/data/extra_services.json"
	}

	h := handlers.New(cfg, dataPath)
	h.Start(context.Background())

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", h.Health)
		r.Get("/overview", h.Overview)
		r.Get("/servers", h.Servers)
		r.Get("/services", h.Services)
		r.Post("/services", h.AddService)
		r.Delete("/services/{name}", h.DeleteService)
		r.Get("/docker", h.DockerContainers)
		r.Get("/docker/{id}", h.DockerContainerDetail)
		r.Get("/docker/{id}/logs", h.ContainerLogs)
		r.Get("/system", h.System)
		r.Get("/config", h.GetConfig)
		r.Put("/config", h.UpdateConfig)
	})

	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "/app/static"
	}

	absStatic, err := filepath.Abs(staticDir)
	if err == nil {
		if info, err := os.Stat(absStatic); err == nil && info.IsDir() {
			log.Printf("serving static files from %s", absStatic)
			fileServer := http.FileServer(http.Dir(absStatic))
			r.Handle("/*", fileServer)
		}
	}

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("starting server on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}
