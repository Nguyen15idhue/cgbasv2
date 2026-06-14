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

	handlers := api.NewHandlers()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handlers.Health)
	mux.HandleFunc("/status", handlers.GetStatus)

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

	var (
		clients   = make(map[string]*ntrip.Client)
		clientsMu sync.RWMutex
	)

	// Initial load
	stations, err := repo.GetActiveNtripStations()
	if err != nil {
		log.Printf("Failed to load initial NTRIP stations: %v", err)
	} else {
		log.Printf("Loaded %d NTRIP stations", len(stations))
		for _, s := range stations {
			client := ntrip.NewClient(repo, s)
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
					_, exists := clients[s.StationID]
					clientsMu.RUnlock()

					if !exists {
						log.Printf("New NTRIP station detected: %s", s.StationID)
						client := ntrip.NewClient(repo, s)
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
