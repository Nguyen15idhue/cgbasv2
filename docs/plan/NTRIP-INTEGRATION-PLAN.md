# KẾ HOẠCH TÍCH HỢP NTRIP CLIENT - DUAL SOURCE STATUS

## 1. TỔNG QUAN

### 1.1 Mục tiêu
Cho phép mỗi trạm GNSS lựa chọn 1 trong 2 nguồn dữ liệu trạng thái:
- **CGBAS PRO** (hiện tại): Đọc từ cloud API của CGBAS
- **NTRIP Client** (mới): Đọc trực tiếp từ NTRIP Caster qua Go service

### 1.2 Nguyên tắc thiết kế
- Mỗi trạm chỉ sử dụng **một nguồn duy nhất** (không song song)
- Người dùng tự chọn nguồn khi tạo/sửa trạm
- Dữ liệu từ cả hai nguồn đều lưu vào **cùng bảng** `station_dynamic_info`
- Hệ thống Recovery **không thay đổi** - vẫn đọc từ DB như hiện tại

---

## 2. KIẾN TRÚC HỆ THỐNG SAU KHI TÍCH HỢP

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE                           │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │   MySQL    │  │  Node.js   │  │  Go Service │  │           │ │
│  │   8.0      │  │  (cgbasv2) │  │  (ntrip)    │  │           │ │
│  │            │  │            │  │             │  │           │ │
│  │ ◄──────────┼──┤  Scheduler │  │  NTRIP      │  │           │ │
│  │   write    │  │  (cgbas)   │  │  Client     │  │           │ │
│  │            │  │            │  │             │  │           │ │
│  │ ◄──────────┼──┤            ├──┼► push DB    │  │           │ │
│  │   read     │  │            │  │             │  │           │ │
│  │            │  │            │  │             │  │           │ │
│  │ ───────────┼──┼────────────┼──┼─────────────┼─┤           │ │
│  │            │  │ AutoMonitor│  │ REST API    │  │           │ │
│  │            │  │ + Recovery │  │ /health     │  │           │ │
│  └────────────┘  └────────────┘  └─────────────┘  └───────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. DATABASE CHANGES

### 3.1 Bảng `stations` - Thêm cột

| Column | Type | Default | Mô tả |
|--------|------|---------|-------|
| `status_source` | ENUM('cgbas','ntrip') | 'cgbas' | Nguồn lấy trạng thái |

### 3.2 Migration
- File: `migrations/013_add_status_source_to_stations.sql`
- Logic: ALTER TABLE thêm cột, cập nhật tất cả trạm hiện tại về 'cgbas'

---

## 4. GO SERVICE (NTRIP CLIENT)

### 4.1 Vai trò
- Kết nối NTRIP Caster theo giao thức NTRIP
- Nhận dữ liệu RTCM từ caster
- Parse trạng thái kết nối (online/offline, số vệ tinh, delay)
- Push dữ liệu vào MySQL (cùng bảng `station_dynamic_info`)

### 4.2 Cấu trúc module chính

| Module | Responsibility |
|--------|---------------|
| `main.go` | Entry point, load config, start services |
| `config/` | Đọc biến môi trường (DB, NTRIP credentials) |
| `ntrip/` | NTRIP client logic (connect, parse, reconnect) |
| `repository/` | MySQL read/write (dùng `database/sql` + `go-sql-driver`) |
| `api/` | REST endpoints health check, station status query |
| `models/` | Struct definitions cho station, dynamic info |

### 4.3 NTRIP Client Flow

```
Startup
  │
  ├─► Query DB: Lấy danh sách trạm có status_source = 'ntrip'
  │
  ├─► Với mỗi trạm:
  │     ├─► Kết nối NTRIP Caster (NTRIP URL + mountpoint + auth)
  │     ├─► Nhận dữ liệu RTCM
  │     ├─► Parse: connectStatus, satellites, delay
  │     └─► Upsert vào station_dynamic_info
  │
  └─► Lặp lại mỗi 5 giây (hoặc theo config)
```

### 4.4 Bảng điều khiển NTRIP

| Field | Mô tả |
|-------|-------|
| `station_id` | Mã trạm (khóa chính) |
| `ntrip_url` | URL NTRIP Caster |
| `mountpoint` | Mount point name |
| `ntrip_user` | Username NTRIP |
| `ntrip_pass` | Password NTRIP |
| `interval` | Tần suất poll (giây) |

### 4.5 Xử lý lỗi
- Mất kết nối NTRIP → Ghi `connectStatus = 3` (Offline)
- Reconnect tự động sau 30 giây
- Log tất cả sự kiện (connection, disconnect, error)

---

## 5. NODE.JS BACKEND CHANGES

### 5.1 Files cần sửa

| File | Thay đổi |
|------|----------|
| `src/utils/scheduler.js` | Thêm conditional check `status_source` trước khi fetch CGBAS |
| `src/repository/stationRepo.js` | Hỗ trợ CRUD với field `status_source` |
| `src/routes/stationRoutes.js` | Thêm validation cho `status_source` |
| `src/services/cgbasApi.js` | Không thay đổi |

### 5.2 Logic Scheduler hiện tại

```
Mỗi 5 giây:
  │
  ├─► Lấy danh sách trạm active
  │
  ├─► Với mỗi trạm:
  │     ├─► NẾU status_source = 'cgbas' → Gọi CGBAS API
  │     └─► NẾU status_source = 'ntrip' → SKIP (Go service xử lý)
  │
  └─► Lưu vào DB (dùng upsert)
```

### 5.3 REST API mới (từ Go service)

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/ntrip/health` | GET | Health check của Go service |
| `/api/ntrip/stations` | GET | Danh sách trạm NTRIP đang manage |
| `/api/ntrip/status/:stationId` | GET | Trạng thái realtime của 1 trạm |

---

## 6. FRONTEND CHANGES

### 6.1 Trang Quản lý Trạm (stations.html)

**Form tạo/sửa trạm:**
- Thêm dropdown `status_source`
  - `CGBAS PRO` (default)
  - `NTRIP Client`
- Khi chọn `NTRIP Client` → Hiển thị thêm các field:
  - NTRIP URL
  - Mountpoint
  - NTRIP Username
  - NTRIP Password

### 6.2 Dashboard

- Thêm badge hiển thị nguồn trạng thái trên mỗi trạm:
  - `CGBAS` - màu xanh
  - `NTRIP` - màu cam
- Filter theo nguồn dữ liệu

### 6.3 Station Detail

- Hiển thị thông tin NTRIP của trạm (nếu có)
- Hiển thị kết nối NTRIP status (connected/disconnected)
- Log các sự kiện NTRIP

---

## 7. DATABASE SCHEMA MỚI

### 7.1 Bảng `ntrip_config` (mới)

| Column | Type | Mô tả |
|--------|------|-------|
| `station_id` | VARCHAR(50) PK | Khóa chính, FK → stations.id |
| `ntrip_url` | VARCHAR(255) | URL NTRIP Caster |
| `mountpoint` | VARCHAR(100) | Mount point name |
| `ntrip_user` | VARCHAR(100) | Username |
| `ntrip_pass` | VARCHAR(255) | Password (encrypted) |
| `interval_seconds` | INT DEFAULT 5 | Tần suất poll |
| `is_active` | TINYINT(1) DEFAULT 1 | Kích hoạt |
| `created_at` | TIMESTAMP | Thời gian tạo |
| `updated_at` | TIMESTAMP | Thời gian cập nhật |

### 7.2 Bảng `ntrip_logs` (mới)

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | BIGINT PK AUTO_INCREMENT | ID |
| `station_id` | VARCHAR(50) | Mã trạm |
| `event_type` | ENUM('connect','disconnect','error','reconnect') | Loại sự kiện |
| `message` | TEXT | Thông tin chi tiết |
| `created_at` | TIMESTAMP | Thời gian |

---

## 8. WORKFLOW CHI TIẾT

### 8.1 Tạo trạm mới với NTRIP

```
User chọn "NTRIP Client" trên Dashboard
  │
  ├─► Nhập thông tin NTRIP (URL, mountpoint, user, pass)
  │
  ├─► POST /api/stations → Lưu vào stations (status_source='ntrip')
  │                         Lưu vào ntrip_config
  │
  ├─► Go service nhận notification (hoặc polling DB)
  │
  └─► Go service bắt đầu kết nối NTRIP cho trạm này
```

### 8.2 Chuyển đổi nguồn giữa CGBAS ↔ NTRIP

```
User thay đổi dropdown status_source
  │
  ├─► PUT /api/stations/:id → Cập nhật status_source
  │
  ├─► NẾU từ cgbas → ntrip:
  │     ├─► Tạo bản ghi trong ntrip_config
  │     └─► Go service bắt đầu manage trạm
  │
  └─► NẾU từ ntrip → cgbas:
        ├─► Xóa bản ghi trong ntrip_config
        └─► Go service dừng manage trạm
```

### 8.3 Recovery Flow (KHÔNG THAY ĐỔI)

```
AutoMonitor (mỗi 5s)
  │
  ├─► Đọc station_dynamic_info (không quan tâm source)
  │
  ├─► Nếu offline đủ ngưỡng → Tạo recovery job
  │
  └─► stationControlService xử lý recovery (giống hiện tại)
```

---

## 9. DEPLOYMENT

### 9.1 Docker Compose

```yaml
services:
  ntrip-service:
    build: ./ntrip-client
    environment:
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_NAME=cgbas
      - DB_USER=root
      - DB_PASS=${DB_PASSWORD}
    depends_on:
      - mysql
    restart: unless-stopped
```

### 9.2 Environment Variables

| Variable | Mô tả | Ví dụ |
|----------|-------|-------|
| `NTRIP_DEFAULT_URL` | URL mặc định | `rtk2go.com:2101` |
| `NTRIP_POLL_INTERVAL` | Tần suất mặc định (giây) | `5` |
| `NTRIP_RECONNECT_DELAY` | Thời gian reconnect (giây) | `30` |

---

## 10. TESTING

### 10.1 Test Cases

| Case | Mô tả | Expected |
|------|-------|----------|
| Tạo trạm CGBAS | Chọn CGBAS, nhập thông tin | Trạm tạo thành công, Scheduler fetch data |
| Tạo trạm NTRIP | Chọn NTRIP, nhập thông tin | Trạm tạo thành công, Go service kết nối |
| Chuyển CGBAS → NTRIP | Sửa trạm, đổi nguồn | Go service bắt đầu manage |
| Chuyển NTRIP → CGBAS | Sửa trạm, đổi nguồn | Go service dừng manage |
| Recovery trạm CGBAS | Trạm offline | Recovery hoạt động bình thường |
| Recovery trạm NTRIP | Trạm offline | Recovery hoạt động bình thường |
| Go service restart | Restart service | Tự reconnect tất cả trạm NTRIP |
| Mất kết nối NTRIP | Caster down | Trạm hiện Offline, auto reconnect |

### 10.2 Monitoring

- Go service expose `/health` endpoint
- Node.js health check polls Go service mỗi 30s
- Dashboard hiển thị trạng thái Go service
- Log aggregation cho cả 2 services

---

## 11. RISK VÀ MITIGATION

| Risk | Impact | Mitigation |
|------|--------|------------|
| Go service crash | Trạm NTRIP mất data | Auto-restart container, health check |
| NTRIP Caster down | Trạm hiện offline | Reconnect logic, alert admin |
| DB connection pool full | Cả 2 service không ghi được | Connection pool tuning, monitoring |
| Data conflict (nghi ngờ) | Không xảy ra | Mỗi trạm chỉ thuộc 1 source |

---

## 12. TIẾN ĐỘ ĐỀ XUẤT

| Phase | Task | Thời gian |
|-------|------|-----------|
| 1 | Database migration (stations, ntrip_config, ntrip_logs) | 0.5 ngày |
| 2 | Go service scaffolding (main, config, models) | 1 ngày |
| 3 | NTRIP client logic (connect, parse, push DB) | 2 ngày |
| 4 | Node.js backend changes (scheduler, routes, validation) | 1 ngày |
| 5 | Frontend changes (form, dashboard, detail) | 1 ngày |
| 6 | Integration testing | 1 ngày |
| 7 | Deployment & monitoring setup | 0.5 ngày |
| **Tổng** | | **7 ngày** |

---

## 13. TÀI LIỆU LIÊN QUAN

- [CGBAS System Documentation](./CGBAS-SYSTEM-DOCUMENTATION.md)
- [Architecture Diagram](./ARCHITECTURE-DIAGRAM.md)
- [Session and Recovery](./SESSION_AND_RECOVERY.md)
