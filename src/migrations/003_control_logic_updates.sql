-- Thêm cột để link trạm CGBAS với thiết bị eWelink (Nếu chưa có)
-- ALTER TABLE stations ADD COLUMN ewelink_device_id VARCHAR(50);
-- Đã comment vì cột này đã tồn tại rồi

-- Bảng quản lý tiến trình phục hồi trạm
CREATE TABLE IF NOT EXISTS station_recovery_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id VARCHAR(50),
    device_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, RUNNING, CHECKING, SUCCESS, FAILED
    retry_index INT DEFAULT 0,            -- Vị trí trong mảng [2, 5, 7, 10...]
    next_run_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE(station_id) -- Mỗi trạm chỉ có 1 tiến trình xử lý tại 1 thời điểm
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;