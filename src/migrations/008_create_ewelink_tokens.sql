-- Migration 008: Create ewelink_tokens table
-- Lưu trữ lịch sử token eWeLink và thời gian hết hạn

CREATE TABLE IF NOT EXISTS ewelink_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry DATETIME NULL COMMENT 'Thời gian hết hạn của Access Token',
    refresh_token_expiry DATETIME NULL COMMENT 'Thời gian hết hạn của Refresh Token',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Lưu trữ lịch sử eWeLink tokens';
