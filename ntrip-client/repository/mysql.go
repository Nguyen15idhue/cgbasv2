package repository

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"ntripclient/models"
)

type MySQL struct {
	db *sql.DB
}

func NewMySQL(host string, port int, user, pass, name string) (*MySQL, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true&charset=utf8mb4",
		user, pass, host, port, name)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	log.Println("Connected to MySQL")
	return &MySQL{db: db}, nil
}

func (m *MySQL) Close() error {
	return m.db.Close()
}

func (m *MySQL) GetActiveNtripStations() ([]models.NtripConfig, error) {
	query := `
		SELECT nc.station_id, nc.ntrip_url, nc.mountpoint, nc.ntrip_user, nc.ntrip_pass, nc.interval_seconds, nc.is_active
		FROM ntrip_config nc
		INNER JOIN stations s ON nc.station_id = s.id
		WHERE nc.is_active = 1 AND s.status_source = 'ntrip'
	`

	rows, err := m.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query ntrip stations: %w", err)
	}
	defer rows.Close()

	var stations []models.NtripConfig
	for rows.Next() {
		var s models.NtripConfig
		if err := rows.Scan(&s.StationID, &s.NtripURL, &s.Mountpoint, &s.NtripUser, &s.NtripPass, &s.IntervalSeconds, &s.IsActive); err != nil {
			log.Printf("Error scanning ntrip station: %v", err)
			continue
		}
		stations = append(stations, s)
	}
	return stations, nil
}

func (m *MySQL) UpsertDynamicInfo(info models.DynamicInfo) error {
	query := `
		INSERT INTO station_dynamic_info 
		(stationId, connectStatus, delay, sat_R, sat_C, sat_E, sat_G)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
		connectStatus = VALUES(connectStatus),
		delay = VALUES(delay),
		sat_R = VALUES(sat_R),
		sat_C = VALUES(sat_C),
		sat_E = VALUES(sat_E),
		sat_G = VALUES(sat_G)
	`

	_, err := m.db.Exec(query,
		info.StationID, info.ConnectStatus, info.Delay,
		info.SatR, info.SatC, info.SatE, info.SatG)
	if err != nil {
		return fmt.Errorf("upsert dynamic info: %w", err)
	}
	return nil
}

func (m *MySQL) InsertLog(stationID, eventType, message string) error {
	query := `INSERT INTO ntrip_logs (station_id, event_type, message) VALUES (?, ?, ?)`

	_, err := m.db.Exec(query, stationID, eventType, message)
	if err != nil {
		return fmt.Errorf("insert log: %w", err)
	}
	return nil
}
