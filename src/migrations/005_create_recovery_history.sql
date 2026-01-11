-- Bảng lưu lịch sử phục hồi trạm
CREATE TABLE IF NOT EXISTS station_recovery_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id VARCHAR(50) NOT NULL,
    device_id VARCHAR(50),
    status VARCHAR(20) NOT NULL,           -- SUCCESS, FAILED
    retry_count INT DEFAULT 0,             -- Số lần thử thực tế
    total_duration_minutes INT,            -- Tổng thời gian từ lúc bắt đầu đến khi kết thúc
    failure_reason TEXT,                   -- Lý do thất bại (nếu FAILED)
    started_at DATETIME,                   -- Thời điểm bắt đầu job
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Thời điểm hoàn thành/thất bại
    INDEX idx_station_id (station_id),
    INDEX idx_status (status),
    INDEX idx_completed_at (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
