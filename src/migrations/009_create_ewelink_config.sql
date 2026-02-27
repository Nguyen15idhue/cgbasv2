-- Migration 009: Create ewelink_config table
-- Lưu trữ toàn bộ cấu hình eWeLink (APPID, APPSECRET, API URL, Tokens)
-- Chỉ có 1 bản ghi duy nhất (singleton pattern)

CREATE TABLE IF NOT EXISTS ewelink_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL COMMENT 'eWeLink App ID',
    app_secret VARCHAR(255) NOT NULL COMMENT 'eWeLink App Secret',
    api_url VARCHAR(500) NOT NULL DEFAULT 'https://as-apia.coolkit.cc' COMMENT 'eWeLink API URL',
    access_token TEXT NULL COMMENT 'Access Token hiện tại',
    refresh_token TEXT NULL COMMENT 'Refresh Token hiện tại',
    token_expiry DATETIME NULL COMMENT 'Thời gian hết hạn của Access Token',
    refresh_token_expiry DATETIME NULL COMMENT 'Thời gian hết hạn của Refresh Token',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Cấu hình eWeLink (singleton - chỉ 1 record)';
