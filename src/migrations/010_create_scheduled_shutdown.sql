-- Bảng cấu hình lịch tắt hàng ngày
CREATE TABLE IF NOT EXISTS scheduled_shutdown_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    shutdown_time TIME NOT NULL DEFAULT '02:00:00' COMMENT 'Thời gian bắt đầu tắt trạm hàng ngày',
    shutdown_duration_minutes INT NOT NULL DEFAULT 5 COMMENT 'Thời gian tắt (phút)',
    batch_size INT NOT NULL DEFAULT 5 COMMENT 'Số trạm xử lý mỗi batch',
    batch_delay_seconds INT NOT NULL DEFAULT 10 COMMENT 'Delay giữa các batch (giây)',
    is_enabled BOOLEAN DEFAULT TRUE COMMENT 'Bật/tắt tính năng',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert config mặc định
INSERT INTO scheduled_shutdown_config (id, shutdown_time, shutdown_duration_minutes, batch_size, batch_delay_seconds, is_enabled) 
VALUES (1, '02:00:00', 5, 5, 10, TRUE)
ON DUPLICATE KEY UPDATE id=id;

-- Bảng theo dõi trạng thái shutdown của từng trạm
CREATE TABLE IF NOT EXISTS scheduled_shutdown_labels (
    station_id VARCHAR(50) PRIMARY KEY,
    labeled_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Thời điểm được gắn nhãn',
    shutdown_completed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Thời điểm hoàn thành tắt',
    poweron_completed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Thời điểm hoàn thành bật',
    status ENUM('pending', 'shutting_down', 'waiting_poweron', 'powering_on', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT NULL,
    FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lịch sử các lần shutdown
CREATE TABLE IF NOT EXISTS scheduled_shutdown_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    execution_date DATE NOT NULL COMMENT 'Ngày thực hiện',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    total_stations INT DEFAULT 0,
    successful_stations INT DEFAULT 0,
    failed_stations INT DEFAULT 0,
    status ENUM('running', 'completed', 'failed') DEFAULT 'running',
    notes TEXT NULL,
    INDEX idx_execution_date (execution_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
