package api

import (
	"encoding/json"
	"net/http"
	"sync"

	"ntripclient/models"
)

type ReloadFunc func(stationID string)

type Handlers struct {
	mu       sync.RWMutex
	statuses map[string]models.DynamicInfo
	onReload ReloadFunc
}

func NewHandlers(onReload ReloadFunc) *Handlers {
	return &Handlers{
		statuses: make(map[string]models.DynamicInfo),
		onReload: onReload,
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

type ReloadRequest struct {
	StationID string `json:"stationId"`
}

func (h *Handlers) Reload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ReloadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.StationID == "" {
		http.Error(w, "stationId is required", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if h.onReload != nil {
		go h.onReload(req.StationID)
		json.NewEncoder(w).Encode(map[string]string{"status": "reloading", "stationId": req.StationID})
	} else {
		json.NewEncoder(w).Encode(map[string]string{"status": "error", "message": "reload not supported"})
	}
}
