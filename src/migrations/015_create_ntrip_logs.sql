-- Migration: 015_create_ntrip_logs.sql
-- Tạo bảng log NTRIP

CREATE TABLE IF NOT EXISTS ntrip_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    station_id VARCHAR(50) NOT NULL,
    event_type ENUM('connect','disconnect','error','reconnect','timeout') NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_station_id (station_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
