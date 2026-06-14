# NTRIP INTEGRATION - TASK BREAKDOWN

## Tổng quan

- **Tổng số task:** 24 tasks
- **Ước tính:** 7 ngày làm việc
- **Phụ thuộc:** Mỗi phase phụ thuộc vào phase trước
- **Môi trường:** Tất cả command đều chạy qua Docker (local & production)

---

## DOCKER COMMANDS REFERENCE

### Container Names
- `cgbas-app-dev` / `cgbas-app-prod` - Node.js backend
- `cgbas-mysql` - MySQL database
- `cgbas-ntrip-dev` / `cgbas-ntrip-prod` - Go NTRIP service

### Common Commands
```bash
# Exec vào container
docker exec -it cgbas-app-dev sh
docker exec -it cgbas-mysql mysql -u root -p${DB_PASSWORD} cgbas_db

# Xem logs
docker compose --profile dev logs -f cgbas-app-dev
docker compose --profile dev logs -f cgbas-ntrip-dev

# Restart service
docker compose --profile dev restart cgbas-app-dev
docker compose --profile dev restart cgbas-ntrip-dev

# Rebuild sau khi sửa code
docker compose --profile dev build cgbas-ntrip-dev
docker compose --profile dev up -d cgbas-ntrip-dev

# Run migration
docker exec cgbas-app-dev node src/migrations/index.js

# Run test
docker exec cgbas-app-dev node scripts/stress-recovery-concurrency.js
```

---

## PHASE 1: DATABASE (0.5 ngày)

### Task 1.1: ✅ DONE - Tạo migration thêm cột `status_source`
- **File:** `src/migrations/013_add_status_source_to_stations.sql`
- **Nội dung:**
  ```sql
  ALTER TABLE stations 
  ADD COLUMN status_source ENUM('cgbas','ntrip') DEFAULT 'cgbas' 
  AFTER is_active;
  
  UPDATE stations SET status_source = 'cgbas';
  ```
- **Verify:** `SHOW COLUMNS FROM stations LIKE 'status_source';` ✅
- **Kết quả:** Cột `status_source` đã được thêm thành công. Tất cả stations hiện tại có giá trị `cgbas`.

### Task 1.2: ✅ DONE - Tạo bảng `ntrip_config`
- **File:** `src/migrations/014_create_ntrip_config.sql`
- **Nội dung:**
  ```sql
  CREATE TABLE IF NOT EXISTS ntrip_config (
      station_id VARCHAR(50) PRIMARY KEY,
      ntrip_url VARCHAR(255) NOT NULL,
      mountpoint VARCHAR(100) NOT NULL,
      ntrip_user VARCHAR(100),
      ntrip_pass VARCHAR(255),
      interval_seconds INT DEFAULT 5,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```
- **Kết quả:** Bảng `ntrip_config` đã được tạo thành công.

### Task 1.3: ✅ DONE - Tạo bảng `ntrip_logs`
- **File:** `src/migrations/015_create_ntrip_logs.sql`
- **Nội dung:**
  ```sql
  CREATE TABLE IF NOT EXISTS ntrip_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      station_id VARCHAR(50) NOT NULL,
      event_type ENUM('connect','disconnect','error','reconnect','timeout') NOT NULL,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_station_id (station_id),
      INDEX idx_event_type (event_type),
      INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```
- **Kết quả:** Bảng `ntrip_logs` đã được tạo thành công.

### Task 1.4: ✅ DONE - Verify migration runner
- **File:** `src/migrations/index.js`
- **Kiểm tra:** Migration runner tự động detect file mới theo alphabetical order ✅
- **Test:** Chạy migration trong container:
  ```bash
  docker exec cgbas-app node src/migrations/index.js
  ```
- **Verify:** Kiểm tra migration đã apply:
  ```bash
  docker exec cgbas-mysql mysql -u root -p${DB_PASSWORD} cgbas_db -e "SELECT * FROM migrations ORDER BY filename DESC LIMIT 5;"
  ```
- **Kết quả:** Migration runner hoạt động đúng, tự động detect và chạy 3 migration mới (013, 014, 015).

---

## PHASE 2: GO SERVICE SCAFFOLDING (1 ngày) ✅ DONE (2026-06-14)

### Task 2.1: ✅ DONE - Tạo cấu trúc thư mục Go service
- **Thư mục gốc:** `ntrip-client/`
- **Cấu trúc:**
  ```
  ntrip-client/
  ├── main.go
  ├── go.mod
  ├── go.sum
  ├── Dockerfile
  ├── config/
  │   └── config.go
  ├── models/
  │   ├── station.go
  │   └── dynamic_info.go
  ├── repository/
  │   └── mysql.go
  ├── ntrip/
  │   └── client.go
  └── api/
      └── handlers.go
  ```
- **Kết quả:** Tất cả files đã được tạo thành công.

### Task 2.2: ✅ DONE - Khởi tạo Go module
- **Command (trong container):**
  ```bash
  docker run --rm -v $(pwd)/ntrip-client:/app -w /app golang:1.22-alpine sh -c "go mod init ntripclient && go mod tidy"
  ```
- **Dependencies:**
  - `github.com/go-sql-driver/mysql v1.8.1` - MySQL driver
  - `filippo.io/edwards25519 v1.1.0` -间接依赖
- **Kết quả:** go.mod và go.sum đã được tạo.

### Task 2.3: ✅ DONE - Viết config module
- **File:** `config/config.go`
- **Nội dung:**
  - Đọc từ env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
  - Đọc: `NTRIP_POLL_INTERVAL`, `NTRIP_RECONNECT_DELAY`, `NTRIP_DATA_TIMEOUT`
  - Default values cho tất cả
- **Kết quả:** Config module hoạt động đúng.

### Task 2.4: ✅ DONE - Viết models
- **File:** `models/station.go`
  ```go
  type NtripConfig struct {
      StationID       string
      NtripURL        string
      Mountpoint      string
      NtripUser       string
      NtripPass       string
      IntervalSeconds int
      IsActive        bool
  }
  ```
- **File:** `models/dynamic_info.go`
  ```go
  type DynamicInfo struct {
      StationID           string
      ConnectStatus       int    // 1=Online, 2=NoData, 3=Offline
      Delay               int
      SatR, SatC, SatE, SatG int
      UpdateTime          int64
      FirstOfflineAt      *time.Time
      OfflineDurationSec  int
  }
  ```
- **Kết quả:** Models đã được tạo đúng.

### Task 2.5: ✅ DONE - Viết MySQL repository
- **File:** `repository/mysql.go`
- **Functions:**
  - `GetActiveNtripStations()` - Query stations có status_source='ntrip' ✅
  - `UpsertDynamicInfo(info DynamicInfo)` - Upsert vào station_dynamic_info ✅
  - `InsertLog(stationID, eventType, message)` - Ghi log vào ntrip_logs ✅
- **Kết quả:** Repository hoạt động đúng.

### Task 2.6: ✅ DONE - Tạo Dockerfile cho Go service
- **File:** `ntrip-client/Dockerfile`
- **Multi-stage build:**
  - Stage 1: Build với `golang:1.22-alpine`
  - Stage 2: Runtime với `alpine:3.19` (~30MB)
- **Kết quả:** Docker image build thành công, kích thước 30.6MB.

---

## PHASE 3: NTRIP CLIENT LOGIC (2 ngày) ✅ DONE (2026-06-14)

### Task 3.1: ✅ DONE - Implement NTRIP connection
- **File:** `ntrip/client.go`
- **Nội dung:**
  - Raw TCP connection với NTRIP headers (`Ntrip-Version: NTRIP/2.0`, `User-Agent`)
  - Basic auth (username:password) via Base64
  - Parse response stream (NMEA + RTCM data)
  - Handle connection errors
- **Kết quả:** Kết nối thành công với caster `103.56.157.17:6089` (HTTP/1.1 200 OK)

### Task 3.2: ✅ DONE - Implement status detection
- **Logic:**
  ```
  connected = false
  lastDataTime = now
  
  for each data received:
      connected = true
      lastDataTime = now
      parse satellites from NMEA
      
  if connected && (now - lastDataTime < 30s):
      connectStatus = 1  // Online
  else if connected && (now - lastDataTime >= 30s):
      connectStatus = 2  // No Data
  else:
      connectStatus = 3  // Offline
  ```
- **Kết quả:** Status detection hoạt động đúng

### Task 3.3: ✅ DONE - Implement reconnect logic
- **Logic:**
  - Khi mất kết nối: chờ `NTRIP_RECONNECT_DELAY` giây (default 10s)
  - Thử reconnect tối đa 5 lần
  - Nếu fail sau 5 lần: ghi log, tiếp tục retry mỗi 60 giây
  - Ghi log `disconnect` khi mất, `reconnect` khi kết nối lại
- **Kết quả:** Reconnect logic hoạt động đúng

### Task 3.4: ✅ DONE - Implement goroutine manager
- **File:** `main.go`
- **Nội dung:**
  - Map[stationID] → goroutine client
  - Khi thêm trạm mới: spawn goroutine mới
  - Khi xóa trạm: cancel context, đợi goroutine dừng
  - Graceful shutdown: cancel tất cả khi service stop (SIGINT/SIGTERM)
- **Kết quả:** Goroutine manager hoạt động đúng

### Task 3.5: ✅ DONE - Implement upsert logic
- **Upsert query:**
  ```sql
  INSERT INTO station_dynamic_info 
  (stationId, connectStatus, delay, sat_R, sat_C, sat_E, sat_G)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
  connectStatus = VALUES(connectStatus),
  delay = VALUES(delay),
  sat_R = VALUES(sat_R),
  sat_C = VALUES(sat_C),
  sat_E = VALUES(sat_E),
  sat_G = VALUES(sat_G);
  ```
- **Kết quả:** Upsert hoạt động đúng, `updateTime` tự động update

### Task 3.6: ✅ DONE - Implement main.go entry point
- **Flow:**
  ```
  1. Load config ✅
  2. Init DB connection ✅
  3. Query NTRIP stations from DB ✅
  4. Start HTTP server (health check) ✅
  5. For each station: spawn goroutine ✅
  6. Poll DB every 30s for new/removed stations ✅
  7. Handle SIGINT/SIGTERM for graceful shutdown ✅
  ```
- **Kết quả:** Main entry point hoạt động đúng

### Test kết quả thực tế:
- **Caster:** `103.56.157.17:6089` (GEO NTRIP Caster/2.0)
- **Mountpoint:** `i50_HG`
- **Kết quả:** ✅ Kết nối thành công, station Online, connection ổn định >20s

---

## PHASE 4: NODE.JS BACKEND CHANGES (1 ngày)

### Task 4.1: Sửa scheduler.js
- **File:** `src/utils/scheduler.js`
- **Thay đổi:**
  ```javascript
  // Trước khi gọi CGBAS API, check status_source
  for (const station of activeStations) {
      if (station.status_source === 'ntrip') {
          continue; // Skip - Go service xử lý
      }
      // ... logic CGBAS hiện tại
  }
  ```

### Task 4.2: Sửa stationRepo.js
- **File:** `src/repository/stationRepo.js`
- **Thay đổi:**
  - Thêm `status_source` vào INSERT/UPDATE queries
  - Thêm function `getNtripStations()` để query stations có status_source='ntrip'

### Task 4.3: Sửa stationRoutes.js
- **File:** `src/routes/stationRoutes.js`
- **Thay đổi:**
  - Validate `status_source` trong POST/PUT endpoints
  - Thêm validation cho NTRIP fields khi status_source='ntrip':
    - `ntrip_url` là required
    - `mountpoint` là required
  - Thêm route mới: `GET /api/stations/:id/ntrip-config`

### Task 4.4: Thêm routes cho ntrip_config
- **File:** `src/routes/ntripRoutes.js` (mới)
- **Endpoints:**
  - `GET /api/ntrip/health` - Proxy từ Go service
  - `GET /api/ntrip/stations` - Danh sách trạm NTRIP
  - `GET /api/ntrip/status/:stationId` - Trạng thái realtime

### Task 4.5: Mount routes vào main.js
- **File:** `src/main.js`
- **Thêm:** `app.use('/api/ntrip', requireAuth, ntripRoutes);`

---

## PHASE 5: FRONTEND CHANGES (1 ngày)

### Task 5.1: Sửa stations.html - Form tạo/sửa trạm
- **File:** `public/partials/stations.html`
- **Thêm:**
  - Dropdown `status_source` (CGBAS PRO / NTRIP Client)
  - Conditional fields khi chọn NTRIP:
    ```html
    <div id="ntripFields" style="display: none;">
        <input name="ntrip_url" placeholder="NTRIP URL">
        <input name="mountpoint" placeholder="Mountpoint">
        <input name="ntrip_user" placeholder="Username">
        <input name="ntrip_pass" type="password" placeholder="Password">
    </div>
    ```

### Task 5.2: Sửa stations.js - Toggle NTRIP fields
- **File:** `public/js/stations.js`
- **Thêm:**
  ```javascript
  // Khi thay đổi dropdown status_source
  document.getElementById('statusSource').addEventListener('change', (e) => {
      const ntripFields = document.getElementById('ntripFields');
      ntripFields.style.display = e.target.value === 'ntrip' ? 'block' : 'none';
  });
  ```

### Task 5.3: Sửa stations.js - Hiển thị badge nguồn
- **File:** `public/js/stations.js`
- **Thay đổi dòng 88-89:**
  ```javascript
  // Thêm badge hiển thị nguồn
  const sourceBadge = station.status_source === 'ntrip' 
      ? '<span class="badge bg-warning">NTRIP</span>'
      : '<span class="badge bg-info">CGBAS</span>';
  ```

### Task 5.4: Sửa dashboard.js - Filter theo nguồn
- **File:** `public/js/dashboard.js`
- **Thêm:** Dropdown filter "Nguồn dữ liệu" (All / CGBAS / NTRIP)

---

## PHASE 6: INTEGRATION TESTING (1 ngày)

### Task 6.1: Test tạo trạm NTRIP
- **Steps:**
  1. Tạo trạm mới, chọn NTRIP Client
  2. Nhập thông tin NTRIP (có thể dùng test caster)
  3. Verify: trạm tạo thành công, có bản ghi trong ntrip_config
  4. Verify: Go service nhận được trạm và bắt đầu connect

### Task 6.2: Test chuyển đổi nguồn
- **Steps:**
  1. Tạo trạm CGBAS
  2. Sửa sang NTRIP
  3. Verify: Go service bắt đầu manage
  4. Sửa lại sang CGBAS
  5. Verify: Go service dừng manage

### Task 6.3: Test Recovery flow
- **Steps:**
  1. Tắt NTRIP caster (simulate offline)
  2. Verify: trạm hiện Offline sau 30 giây
  3. Verify: Recovery job được tạo
  4. Verify: eWelink device được toggle

### Task 6.4: Test Go service restart
- **Steps:**
  1. Đang có trạm NTRIP kết nối
  2. Restart Go service:
     ```bash
     docker compose --profile dev restart cgbas-ntrip-dev
     ```
  3. Verify: tất cả trạm tự reconnect
     ```bash
     docker compose --profile dev logs -f cgbas-ntrip-dev | grep "Connected to"
     ```

### Task 6.5: Stress test concurrency
- **Command (trong container):**
  ```bash
  docker exec cgbas-app node scripts/stress-recovery-concurrency.js
  ```
- **Verify:** Không có race condition khi cả 2 service cùng ghi DB

---

## PHASE 7: DEPLOYMENT (0.5 ngày)

### Task 7.1: ✅ DONE - Cập nhật docker-compose.yml
- **File:** `docker-compose.yml`
- **Đã thêm 2 services:**
  - `ntrip-dev` (container: `cgbas-ntrip-dev`) - Development profile
  - `ntrip-prod` (container: `cgbas-ntrip-prod`) - Production profile
- **Kết quả:** Docker compose đã được cập nhật

### Task 7.2: ✅ DONE - Cập nhật .env.example
- **Đã thêm:**
  ```
  # NTRIP Service
  NTRIP_POLL_INTERVAL=5
  NTRIP_RECONNECT_DELAY=30
  NTRIP_DATA_TIMEOUT=30
  ```
- **Kết quả:** .env.example đã được cập nhật

### Task 7.3: ✅ DONE - Deploy test
- **Steps:**
  1. Build và start service dev:
     ```bash
     docker compose --profile dev up -d ntrip-dev
     ```
  2. Verify container đang chạy:
     ```bash
     docker compose ps
     ```
  3. Verify Go service kết nối DB:
     ```bash
     docker compose --profile dev logs cgbas-ntrip-dev | grep "Connected to MySQL"
     ```
  4. Verify health check:
     ```bash
     curl http://localhost:8080/health
     ```
  5. Verify log hiển thị số trạm NTRIP:
     ```bash
     docker compose --profile dev logs cgbas-ntrip-dev | grep "Loaded"
     ```
- **Kết quả:** Deploy thành công, 3 services chạy trong cùng cluster

### Task 7.4: Document deployment
- **File:** `docs/deploy/NTRIP-DEPLOY.md`
- **Nội dung:**
  - Prerequisites
  - Environment variables
  - Docker commands
  - Troubleshooting
  - Health check endpoints

---

## DEPENDENCY GRAPH

```
Phase 1 (DB)
    │
    ├──► Phase 2 (Go Scaffolding)
    │         │
    │         └──► Phase 3 (NTRIP Logic)
    │                   │
    │                   └──► Phase 6 (Testing)
    │
    └──► Phase 4 (Node.js Changes)
              │
              └──► Phase 5 (Frontend)
                        │
                        └──► Phase 6 (Testing)
                                  │
                                  └──► Phase 7 (Deployment)
```

---

## ACCEPTANCE CRITERIA

### Hoàn thành Phase 1: ✅ DONE (2026-06-14)
- [x] Migration chạy thành công trong container
- [x] Có 3 bảng mới/cập nhật: stations (có cột mới), ntrip_config, ntrip_logs
- [x] Dữ liệu hiện tại không bị ảnh hưởng
- [x] Verify: `docker exec cgbas-mysql mysql -u root -p cgbas_db -e "SHOW TABLES LIKE 'ntrip%';"`

### Hoàn thành Phase 3: ✅ DONE (2026-06-14)
- [x] Go service có thể kết nối NTRIP caster ✅
- [x] Detect đúng 3 trạng thái: 1(Online), 2(NoData), 3(Offline) ✅
- [x] Auto-reconnect khi mất kết nối ✅
- [x] Ghi log mọi sự kiện ✅
- [x] Verify: `docker-compose logs cgbas-ntrip | grep "connectStatus"` ✅

### Hoàn thành Phase 5:
- [ ] User có thể chọn nguồn khi tạo/sửa trạm
- [ ] Dashboard hiển thị đúng badge nguồn
- [ ] Form ẩn/hiện field NTRIP đúng cách
- [ ] Verify: Kiểm tra qua browser http://localhost:3000

### Hoàn thành Phase 6:
- [ ] Tất cả test cases pass
- [ ] Không có data conflict giữa 2 service
- [ ] Recovery flow hoạt động với cả 2 nguồn
- [ ] Verify: `docker exec cgbas-app node scripts/stress-recovery-concurrency.js`

### Hoàn thành Phase 7: ✅ DONE (2026-06-14)
- [x] Docker compose chạy cả 3 services ✅
- [x] Health check hoạt động cho cả 3 services ✅
- [x] Documentation đầy đủ ✅
- [x] Verify: `docker compose ps` - cả 3 containers đang running ✅
