package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/pradiptamahardika/homelab-monitor/config"
	"github.com/pradiptamahardika/homelab-monitor/handlers"
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

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Compress(5))
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
		r.Get("/version", h.Version)
		r.Get("/servers", h.Servers)
		r.Post("/servers", h.AddServer)
		r.Put("/servers/{name}", h.UpdateServer)
		r.Delete("/servers/{name}", h.DeleteServer)
		r.Get("/services", h.Services)
		r.Post("/services", h.AddService)
		r.Put("/services/{name}", h.UpdateService)
		r.Delete("/services/{name}", h.DeleteService)
		r.Get("/docker", h.DockerContainers)
		r.Get("/docker/{id}", h.DockerContainerDetail)
		r.Get("/system", h.System)
		r.Get("/overview", h.Overview)
		r.Get("/config", h.GetConfig)
		r.Put("/config", h.UpdateConfig)
		r.Get("/export", h.ExportConfig)
		r.Post("/import", h.ImportConfig)
		r.Get("/dependencies", h.GetDependencies)
		r.Post("/dependencies", h.AddDependency)
		r.Put("/dependencies", h.UpdateDependency)
		r.Delete("/dependencies", h.DeleteDependency)
		r.Get("/history", h.History)
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
			r.Group(func(r chi.Router) {
				r.Use(cacheControl)
				r.Handle("/*", fileServer)
			})
		}
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	h.Start(ctx)

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("starting server on %s", addr)
	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		<-ctx.Done()
		log.Println("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

// cacheControl sets long-lived immutable caching for content-hashed build assets
// and no-cache for everything else (index.html, API paths).
func cacheControl(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		next.ServeHTTP(w, r)
	})
}
