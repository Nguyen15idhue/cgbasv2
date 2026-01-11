# 🗄️ Database Schema

Tổng quan về cấu trúc database MySQL của hệ thống CGBAS v2.

---

## Database Info

- **Engine**: InnoDB
- **Charset**: utf8mb4
- **Collation**: utf8mb4_unicode_ci
- **Version**: MySQL 8.0+

---

## Tables Overview

| Table | Rows (Est.) | Purpose |
|-------|-------------|---------|
| users | ~10 | Quản lý người dùng hệ thống |
| stations | ~150 | Thông tin cơ bản trạm RTK (từ CGBAS) |
| station_dynamic_info | ~150 | Thông tin real-time trạm (vệ tinh, delay) |
| station_recovery_jobs | ~5-20 | Queue job phục hồi đang chạy |
| station_recovery_history | ~1000+ | Lịch sử phục hồi trạm |
| ewelink_devices | ~25 | Thông tin thiết bị eWelink |
| ewelink_status | ~25 | Trạng thái realtime thiết bị |
| ewelink_api_logs | ~10000+ | Log mọi API call đến eWelink |
| migrations | ~5 | Tracking migration history |

---

## Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────────┐
│   users     │         │   stations           │
└─────────────┘         │  - id (PK)           │
                        │  - stationName       │
                        │  - ewelink_device_id │
                        └──────────────────────┘
                               │    │    │
                ┌──────────────┘    │    └──────────────┐
                │                   │                   │
                ▼                   ▼                   ▼
    ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────┐
    │ station_dynamic  │  │ recovery_jobs     │  │ recovery_history     │
    │     _info        │  │  - station_id (FK)│  │  - station_id (FK)   │
    │  - stationId(FK) │  │  - device_id      │  │  - device_id         │
    │  - connectStatus │  │  - status         │  │  - status            │
    │  - sat_R/C/E/G   │  │  - retry_index    │  │  - retry_count       │
    └──────────────────┘  └───────────────────┘  │  - failure_reason    │
                                                  └──────────────────────┘

    ┌──────────────────┐         ┌───────────────────┐
    │ ewelink_devices  │◄────┐   │ ewelink_status    │
    │  - deviceid (PK) │     └───│  - deviceid (FK)  │
    │  - name          │         │  - switch_0       │
    │  - online        │         │  - switch_1       │
    └──────────────────┘         │  - voltage_0      │
            │                    └───────────────────┘
            │
            ▼
    ┌──────────────────┐
    │ ewelink_api_logs │
    │  - endpoint      │
    │  - payload       │
    │  - response_body │
    │  - duration_ms   │
    └──────────────────┘
```

---

## Table Details

### 1. `users`

Quản lý người dùng hệ thống.

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,      -- bcrypt hashed
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user',     -- admin, user
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
);
```

**Sample Data:**
```json
{
  "id": 1,
  "username": "admin",
  "password": "$2a$10$...",
  "full_name": "Administrator",
  "role": "admin"
}
```

---

### 2. `stations`

Thông tin cơ bản trạm RTK (từ CGBAS PRO API).

```sql
CREATE TABLE stations (
    id VARCHAR(50) PRIMARY KEY,
    stationName VARCHAR(100),
    identificationName VARCHAR(100),
    stationType VARCHAR(50),
    lat DECIMAL(10, 7),
    lng DECIMAL(10, 7),
    ewelink_device_id VARCHAR(50) DEFAULT NULL,  -- Link với eWelink
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_station_name (stationName),
    INDEX idx_ewelink_device (ewelink_device_id)
);
```

**Sample Data:**
```json
{
  "id": "STA001",
  "stationName": "Trạm RTK Hà Nội",
  "identificationName": "HN-RTK-01",
  "stationType": "CORS",
  "lat": 21.0285,
  "lng": 105.8542,
  "ewelink_device_id": "1000abc123"
}
```

---

### 3. `station_dynamic_info`

Thông tin real-time của trạm (cập nhật mỗi 15 giây).

```sql
CREATE TABLE station_dynamic_info (
    stationId VARCHAR(50) PRIMARY KEY,
    connectStatus TINYINT,              -- 0:Chưa kết nối, 1:Online, 2:Chưa định vị, 3:Offline
    delay INT,                          -- Độ trễ (ms)
    sat_R INT DEFAULT 0,                -- Số vệ tinh GPS
    sat_C INT DEFAULT 0,                -- Số vệ tinh BeiDou
    sat_E INT DEFAULT 0,                -- Số vệ tinh Galileo
    sat_G INT DEFAULT 0,                -- Số vệ tinh GLONASS
    updateTime BIGINT,                  -- Unix timestamp
    FOREIGN KEY (stationId) REFERENCES stations(id) ON DELETE CASCADE
);
```

**Connect Status:**
- `0` - Chưa kết nối
- `1` - Online ✅
- `2` - Chưa định vị
- `3` - Offline ❌

---

### 4. `station_recovery_jobs`

Queue các job phục hồi đang chạy/chờ.

```sql
CREATE TABLE station_recovery_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id VARCHAR(50) UNIQUE,
    device_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, RUNNING, CHECKING, FAILED
    retry_index INT DEFAULT 0,              -- Index trong [2,5,10,15,30,60]
    next_run_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_next_run (next_run_time)
);
```

**Job Lifecycle:**
```
PENDING → RUNNING → CHECKING
    ↓         ↓         ↓
  (Reschedule if fail) → SUCCESS → Delete from table
                              ↓
                         Save to history
```

---

### 5. `station_recovery_history`

Lịch sử tất cả các lần phục hồi (SUCCESS + FAILED).

```sql
CREATE TABLE station_recovery_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id VARCHAR(50) NOT NULL,
    device_id VARCHAR(50),
    status VARCHAR(20) NOT NULL,           -- SUCCESS, FAILED
    retry_count INT DEFAULT 0,
    total_duration_minutes INT,
    failure_reason TEXT,
    started_at DATETIME,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_station_id (station_id),
    INDEX idx_status (status),
    INDEX idx_completed_at (completed_at)
);
```

**Sample Data:**
```json
{
  "id": 1,
  "station_id": "STA001",
  "device_id": "1000abc123",
  "status": "SUCCESS",
  "retry_count": 2,
  "total_duration_minutes": 12,
  "failure_reason": null,
  "started_at": "2026-01-11 08:00:00",
  "completed_at": "2026-01-11 08:12:00"
}
```

---

### 6. `ewelink_devices`

Thông tin cơ bản thiết bị eWelink.

```sql
CREATE TABLE ewelink_devices (
    deviceid VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    online BOOLEAN DEFAULT FALSE,
    model VARCHAR(50),
    brandName VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);
```

---

### 7. `ewelink_status`

Trạng thái realtime các kênh relay.

```sql
CREATE TABLE ewelink_status (
    deviceid VARCHAR(50) PRIMARY KEY,
    switch_0 VARCHAR(10),               -- Kênh 1: on/off
    switch_1 VARCHAR(10),               -- Kênh 2: on/off
    voltage_0 VARCHAR(20),              -- Điện áp kênh 1 (V)
    updateTime BIGINT,
    FOREIGN KEY (deviceid) REFERENCES ewelink_devices(deviceid) ON DELETE CASCADE
);
```

---

### 8. `ewelink_api_logs`

Log tất cả API calls đến eWelink Cloud.

```sql
CREATE TABLE ewelink_api_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    method VARCHAR(10),                 -- GET, POST, PUT, DELETE
    endpoint VARCHAR(255),
    payload TEXT,
    response_code INT,
    response_body TEXT,
    duration_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at),
    INDEX idx_endpoint (endpoint)
);
```

**Usage:**
- Debug API issues
- Rate limit monitoring
- Performance analysis

---

### 9. `migrations`

Tracking migration history.

```sql
CREATE TABLE migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Relationships

### One-to-One

- `stations.id` ↔ `station_dynamic_info.stationId`
- `ewelink_devices.deviceid` ↔ `ewelink_status.deviceid`

### One-to-Many

- `stations.id` → `station_recovery_jobs.station_id`
- `stations.id` → `station_recovery_history.station_id`

### Soft Link (No FK)

- `stations.ewelink_device_id` ⇢ `ewelink_devices.deviceid`

---

## Indexes Strategy

### Performance Indexes

```sql
-- Tra cứu trạm nhanh
CREATE INDEX idx_station_name ON stations(stationName);
CREATE INDEX idx_connect_status ON station_dynamic_info(connectStatus);

-- Recovery jobs
CREATE INDEX idx_status ON station_recovery_jobs(status);
CREATE INDEX idx_next_run ON station_recovery_jobs(next_run_time);

-- History reports
CREATE INDEX idx_completed_at ON station_recovery_history(completed_at);
CREATE INDEX idx_station_status ON station_recovery_history(station_id, status);

-- API logs cleanup
CREATE INDEX idx_created_at ON ewelink_api_logs(created_at);
```

---

## Data Retention

### Auto-Cleanup Strategy

```sql
-- Xóa API logs cũ hơn 30 ngày
DELETE FROM ewelink_api_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Xóa recovery history cũ hơn 90 ngày
DELETE FROM station_recovery_history 
WHERE completed_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

**Khuyến nghị**: Chạy cleanup hàng tuần qua cron job.

---

## Backup Strategy

### Daily Backup

```bash
# Full backup
mysqldump -u root -p cgbas_db > backup_$(date +%Y%m%d).sql

# Backup specific tables (exclude logs)
mysqldump -u root -p cgbas_db \
  --ignore-table=cgbas_db.ewelink_api_logs \
  > backup_core_$(date +%Y%m%d).sql
```

### Critical Tables (Priority backup)

1. `users`
2. `stations`
3. `station_recovery_history`
4. `ewelink_devices`

---

## Migration Management

### Running Migrations

```bash
node src/migrations/index.js
```

### Migration Files

```
src/migrations/
├── 001_create_stations_table.sql
├── 002_create_ewelink_tables.sql
├── 003_control_logic_updates.sql
├── 004_create_api_logs.sql
├── 005_create_recovery_history.sql
└── index.js
```

### Migration Tracking

```sql
SELECT * FROM migrations ORDER BY executed_at DESC;
```

---

**Related:**
- [Tables Reference](./tables.md) - Chi tiết từng trường
- [Relationships](./relationships.md) - Quan hệ ERD
- [Migrations Guide](./migrations.md) - Quản lý migration
