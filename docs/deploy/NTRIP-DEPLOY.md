# 🚀 NTRIP Client Service - Deployment Guide

## 📌 Prerequisites

- Docker & Docker Compose
- MySQL container running (`cgbas-mysql`)
- Network: `cgbasv2_cgbas-network`

---

## 🔧 Environment Variables

```env
# NTRIP Service
NTRIP_POLL_INTERVAL=5          # Poll DB mỗi 5 giây
NTRIP_RECONNECT_DELAY=30       # Delay reconnect ban đầu (giây)
NTRIP_DATA_TIMEOUT=30          # Timeout data không có mới (giây)
```

---

## 🏗️ Build & Start

### Development

```bash
cd C:\laragon\www\cgbasv2

# Build và start
docker compose --profile dev up -d ntrip-dev

# Verify
docker ps -a | grep cgbas-ntrip
docker compose --profile dev logs cgbas-ntrip-dev | grep "Connected to MySQL"
```

### Production

```bash
cd /opt/cgbasv2

# Build và start
docker compose --profile prod up -d ntrip-prod

# Verify
docker ps -a | grep cgbas-ntrip
docker compose --profile prod logs cgbas-ntrip-prod | grep "Connected to MySQL"
```

---

## 🏥 Health Check

```bash
# Health
curl http://localhost:3101/health

# Status (tất cả trumps NTRIP)
curl http://localhost:3101/status

# Reload config (khi đổi config trong DB)
curl -X POST http://localhost:3101/reload
```

---

## 📊 Xem Logs

```bash
# Development
docker compose --profile dev logs -f --tail=100 cgbas-ntrip-dev

# Production
docker compose --profile prod logs -f --tail=100 cgbas-ntrip-prod
```

### Log Samples

```
2026/06/14 19:03:01 Loaded 2 NTRIP stations
2026/06/14 19:03:01 [NTRIP:74] Connecting to 103.56.157.17:6089...
2026/06/14 19:03:01 [NTRIP:74] Connected to http://103.56.157.17:6089 (mountpoint: i50_HG)
2026/06/14 19:03:01 [NTRIP:74] Updated status for 74: satellites=12, connected
```

---

## 🔄 Restart Service

```bash
# Development
docker compose --profile dev restart ntrip-dev

# Production
docker compose --profile prod restart ntrip-prod
```

---

## 🐛 Troubleshooting

### Container không start

```bash
# Kiểm tra logs
docker compose --profile dev logs cgbas-ntrip-dev

# Rebuild
docker compose --profile dev up -d --build ntrip-dev
```

### Không kết nối được DB

```bash
# Kiểm tra MySQL container
docker ps -a | grep cgbas-mysql

# Kiểm tra network
docker network inspect cgbasv2_cgbas-network
```

### Không kết nối được NTRIP caster

```bash
# Test kết nối caster
docker exec cgbas-ntrip-dev wget -q -O - "http://103.56.157.17:6089" --header="Ntrip-Version: Ntrip/2.0" --header="User-Agent: NTRIP Client" --timeout=5

# Kiểm tra config trong DB
docker exec cgbas-mysql mysql -u root -pcgbaspassword cgbas_db -e "SELECT * FROM ntrip_config;"
```

### Trạm không nhận data NTRIP

```bash
# Kiểm tra status_source trong DB
docker exec cgbas-mysql mysql -u root -pcgbaspassword cgbas_db -e "SELECT id, status_source FROM stations WHERE status_source='ntrip';"

# Kiểm tra Go service đang manage trạm nào
docker exec cgbas-mysql mysql -u root -pcgbaspassword cgbas_db -e "SELECT stationId, connectStatus, updateTime FROM station_dynamic_info WHERE connectStatus=1;"
```

---

## 📡 API Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/health` | GET | Health check |
| `/status` | GET | Danh sách trumps NTRIP + trạng thái |
| `/reload` | POST | Reload config từ DB (instant) |

---

## 🔗 Integration with Node.js Backend

Node.js backend proxy NTRIP requests qua `src/routes/ntripRoutes.js`:

```javascript
// Base URL
const NTRIP_BASE_URL = process.env.NTRIP_BASE_URL || 'http://ntrip-dev:8080';
```

Frontend gọi qua `/api/ntrip/*` endpoints.

---

## 📝 Database Schema

```sql
-- NTRIP config
CREATE TABLE ntrip_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  station_id VARCHAR(50),
  caster_url VARCHAR(255),
  mountpoint VARCHAR(100),
  username VARCHAR(100),
  password VARCHAR(255),
  ...
);

-- NTRIP logs
CREATE TABLE ntrip_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  station_id VARCHAR(50),
  event_type ENUM('connect','disconnect','error','reconnect'),
  ...
);
```
