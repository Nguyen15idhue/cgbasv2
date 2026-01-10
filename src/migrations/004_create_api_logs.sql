CREATE TABLE IF NOT EXISTS ewelink_api_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    method VARCHAR(10),
    endpoint VARCHAR(255),
    payload LONGTEXT,             -- Đổi từ TEXT sang LONGTEXT
    response_code INT,
    response_body LONGTEXT,       -- Đổi từ TEXT sang LONGTEXT
    duration_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;