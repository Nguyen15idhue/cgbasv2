package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"ntripclient/api"
	"ntripclient/config"
	"ntripclient/models"
	"ntripclient/ntrip"
	"ntripclient/repository"
)

func main() {
	cfg := config.Load()

	log.Println("Starting NTRIP Client Service...")

	repo, err := repository.NewMySQL(cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPass, cfg.DBName)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer repo.Close()

	var (
		clients   = make(map[string]*ntrip.Client)
		clientsMu sync.RWMutex
	)

	var handlers *api.Handlers

	reloadStation := func(stationID string) {
		clientsMu.Lock()
		defer clientsMu.Unlock()

		existing, exists := clients[stationID]
		if exists {
			log.Printf("[Reload] Stopping old client for %s", stationID)
			existing.Stop()
			delete(clients, stationID)
		}

		cfgs, err := repo.GetActiveNtripStations()
		if err != nil {
			log.Printf("[Reload] Failed to load station %s: %v", stationID, err)
			return
		}

		for _, s := range cfgs {
			if s.StationID == stationID {
				log.Printf("[Reload] Starting new client for %s (url=%s mountpoint=%s)", stationID, s.NtripURL, s.Mountpoint)
				client := ntrip.NewClient(repo, handlers, s)
				clients[stationID] = client
				go client.Run(cfg.NTRIPDataTimeout, cfg.NTRIPReconnectDelay)
				return
			}
		}

		log.Printf("[Reload] Station %s not found in DB or inactive, skipping", stationID)
	}

	handlers = api.NewHandlers(reloadStation)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handlers.Health)
	mux.HandleFunc("/status", handlers.GetStatus)
	mux.HandleFunc("/reload", handlers.Reload)

	server := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: mux,
	}

	go func() {
		log.Printf("HTTP server listening on %s", cfg.ListenAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initial load
	stations, err := repo.GetActiveNtripStations()
	if err != nil {
		log.Printf("Failed to load initial NTRIP stations: %v", err)
	} else {
		log.Printf("Loaded %d NTRIP stations", len(stations))
		for _, s := range stations {
			client := ntrip.NewClient(repo, handlers, s)
			clientsMu.Lock()
			clients[s.StationID] = client
			clientsMu.Unlock()
			go client.Run(cfg.NTRIPDataTimeout, cfg.NTRIPReconnectDelay)
		}
	}

	// Poll for new/removed stations
	pollTicker := time.NewTicker(30 * time.Second)
	defer pollTicker.Stop()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-pollTicker.C:
				newStations, err := repo.GetActiveNtripStations()
				if err != nil {
					log.Printf("Failed to poll NTRIP stations: %v", err)
					continue
				}

				activeIDs := make(map[string]bool)
				for _, s := range newStations {
					activeIDs[s.StationID] = true

					clientsMu.RLock()
					existing, exists := clients[s.StationID]
					clientsMu.RUnlock()

					if !exists {
						log.Printf("New NTRIP station detected: %s", s.StationID)
						client := ntrip.NewClient(repo, handlers, s)
						clientsMu.Lock()
						clients[s.StationID] = client
						clientsMu.Unlock()
						go client.Run(cfg.NTRIPDataTimeout, cfg.NTRIPReconnectDelay)
					} else if configChanged(existing.GetConfig(), s) {
						log.Printf("NTRIP config changed for %s, restarting", s.StationID)
						existing.Stop()
						client := ntrip.NewClient(repo, handlers, s)
						clientsMu.Lock()
						clients[s.StationID] = client
						clientsMu.Unlock()
						go client.Run(cfg.NTRIPDataTimeout, cfg.NTRIPReconnectDelay)
					}
				}

				clientsMu.Lock()
				for id, client := range clients {
					if !activeIDs[id] {
						log.Printf("Removing NTRIP station: %s", id)
						client.Stop()
						delete(clients, id)
					}
				}
				clientsMu.Unlock()
			}
		}
	}()

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("Shutting down...")
	cancel()

	clientsMu.Lock()
	for id, client := range clients {
		log.Printf("Stopping client for station: %s", id)
		client.Stop()
	}
	clientsMu.Unlock()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	log.Println("NTRIP Client Service stopped")
}

func configChanged(old models.NtripConfig, new models.NtripConfig) bool {
	return old.NtripURL != new.NtripURL ||
		old.Mountpoint != new.Mountpoint ||
		old.NtripUser != new.NtripUser ||
		old.NtripPass != new.NtripPass
}
