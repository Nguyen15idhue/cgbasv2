CREATE TABLE IF NOT EXISTS stations (
    id VARCHAR(50) PRIMARY KEY,
    stationName VARCHAR(100),
    identificationName VARCHAR(255),
    stationType INT,
    receiverType VARCHAR(100),
    antennaType VARCHAR(100),
    antennaHigh DECIMAL(10, 4),
    lat DOUBLE,
    lng DOUBLE,
    status INT,
    createTime BIGINT,
    updateTime BIGINT,
    syncTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Thêm bảng thông tin động
CREATE TABLE IF NOT EXISTS station_dynamic_info (
    stationId VARCHAR(50) PRIMARY KEY,
    connectStatus INT,
    epochTime BIGINT,
    delay VARCHAR(20),
    sat_R INT DEFAULT 0, -- Glonass
    sat_C INT DEFAULT 0, -- Beidou
    sat_E INT DEFAULT 0, -- Galileo
    sat_G INT DEFAULT 0, -- GPS
    updateTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;