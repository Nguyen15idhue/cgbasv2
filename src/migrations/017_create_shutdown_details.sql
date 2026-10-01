CREATE TABLE IF NOT EXISTS scheduled_shutdown_details (
    id INT PRIMARY KEY AUTO_INCREMENT,
    history_id INT NOT NULL COMMENT 'FK ve scheduled_shutdown_history.id',
    station_id VARCHAR(50) NOT NULL COMMENT 'Ma tram',
    device_id VARCHAR(50) NULL COMMENT 'eWeLink deviceid tai thoi diem chay',
    shutdown_ok BOOLEAN NULL COMMENT 'Ket qua pha tat: 1 OK, 0 loi, NULL chua chay',
    shutdown_error TEXT NULL COMMENT 'Loi pha tat (nguyen van)',
    shutdown_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Thoi diem xong pha tat',
    poweron_ok BOOLEAN NULL COMMENT 'Ket qua pha bat: 1 OK, 0 loi, NULL chua chay / bi bo qua',
    poweron_error TEXT NULL COMMENT 'Loi pha bat (nguyen van)',
    poweron_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Thoi diem xong pha bat',
    final_status ENUM('completed','failed','skipped') DEFAULT 'failed' COMMENT 'completed: tat+bat OK; failed: loi; skipped: bo qua pha bat do tat loi',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_history_station (history_id, station_id),
    INDEX idx_history_status (history_id, final_status),
    CONSTRAINT fk_details_history FOREIGN KEY (history_id)
        REFERENCES scheduled_shutdown_history(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
