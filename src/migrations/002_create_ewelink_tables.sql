CREATE TABLE IF NOT EXISTS ewelink_devices (
    deviceid VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    model VARCHAR(50),
    online BOOLEAN,
    familyid VARCHAR(100),
    apikey VARCHAR(100),
    lastUpdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ewelink_status (
    deviceid VARCHAR(50) PRIMARY KEY,
    switch_0 VARCHAR(10), -- Kênh 1 (on/off)
    switch_1 VARCHAR(10), -- Kênh 2 (on/off)
    voltage_0 INT,
    current_0 INT,
    actPow_0 INT,
    updateTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (deviceid) REFERENCES ewelink_devices(deviceid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;