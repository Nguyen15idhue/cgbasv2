package api

import (
	"encoding/json"
	"net/http"
	"sync"

	"ntripclient/models"
)

type Handlers struct {
	mu       sync.RWMutex
	statuses map[string]models.DynamicInfo
}

func NewHandlers() *Handlers {
	return &Handlers{
		statuses: make(map[string]models.DynamicInfo),
	}
}

func (h *Handlers) UpdateStatus(info models.DynamicInfo) {
	h.mu.Lock()
	h.statuses[info.StationID] = info
	h.mu.Unlock()
}

type HealthResponse struct {
	Status string `json:"status"`
}

func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(HealthResponse{Status: "ok"})
}

type StatusResponse struct {
	StationID string `json:"stationId"`
	Status    int    `json:"status"`
}

func (h *Handlers) GetStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	h.mu.RLock()
	defer h.mu.RUnlock()

	statuses := make([]StatusResponse, 0, len(h.statuses))
	for _, info := range h.statuses {
		statuses = append(statuses, StatusResponse{
			StationID: info.StationID,
			Status:    info.ConnectStatus,
		})
	}

	json.NewEncoder(w).Encode(statuses)
}
