-- Migration: Thêm cột tracking trạng thái offline
-- Mục đích: Lưu thời điểm bắt đầu và thời gian offline liên tục để tránh false positive

ALTER TABLE station_dynamic_info 
ADD COLUMN first_offline_at DATETIME NULL COMMENT 'Lần đầu phát hiện trạng thái bất thường (status != 1)',
ADD COLUMN offline_duration_seconds INT DEFAULT 0 COMMENT 'Thời gian bất thường liên tục (giây)';

-- Thêm index để tối ưu query tạo Job
CREATE INDEX idx_offline_duration ON station_dynamic_info(connectStatus, offline_duration_seconds);
