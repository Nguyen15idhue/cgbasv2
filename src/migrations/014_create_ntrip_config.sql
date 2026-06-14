-- Migration: 014_create_ntrip_config.sql
-- Tạo bảng cấu hình NTRIP

CREATE TABLE IF NOT EXISTS ntrip_config (
    station_id VARCHAR(50) PRIMARY KEY,
    ntrip_url VARCHAR(255) NOT NULL,
    mountpoint VARCHAR(100) NOT NULL,
    ntrip_user VARCHAR(100),
    ntrip_pass VARCHAR(255),
    interval_seconds INT DEFAULT 5,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
