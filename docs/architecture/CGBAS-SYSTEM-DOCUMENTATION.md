# Tài liệu Kỹ thuật - Hệ thống CGBAS v2

## 1. Tổng quan hệ thống

### Mục tiêu
Hệ thống CGBAS v2 là một ứng dụng giám sát và tự động phục hồi trạm RTK (Real-Time Kinematics) thông qua thiết bị điều khiển eWeLink. Hệ thống kết nối với API CGBAS để lấy thông tin trạm, giám sát trạng thái online/offline và tự động thực hiện các thao tác phục hồi khi trạm gặp sự cố.

### Các tính năng chính
- Giám sát trạng thái trạm RTK theo thời gian thực
- Tự động phục hồi trạm khi offline (Auto Recovery)
- Quản lý thiết bị eWeLink (bật/tắt kênh relay)
- Đồng bộ danh mục trạm từ API CGBAS
- Scheduled Shutdown - Lịch tắt/bật trạm theo lịch hàng ngày
- OAuth authentication với eWeLink Cloud
- Quản lý cấu hình hệ thống
- Báo cáo và thống kê lịch sử phục hồi

---

## 2. Kiến trúc và công nghệ

### Stack công nghệ
| Thành phần | Công nghệ |
|------------|-----------|
| Backend | Node.js + Express.js |
| Database | MySQL 8.0+ |
| Frontend | HTML/JS (SPA) |
| Scheduling | node-cron |
| Authentication | Express-session + bcrypt |
| API Integration | axios |

### Cấu trúc thư mục
```
src/
├── config/          # Cấu hình database
├── controllers/     # Xử lý request (auth)
├── middleware/      # Auth middleware
├── migrations/     # Database migrations
├── repository/     # Data access layer (stationRepo, ewelinkRepo)
├── routes/         # API routes
├── services/       # Business logic (ewelinkService, cgbasApi, stationControlService, scheduledShutdownService)
├── utils/          # Tiện ích (logger, scheduler, helper, telegramNotify)
└── main.js         # Entry point
```

---

## 3. Luồng xử lý chính

### 3.1. Khởi động hệ thống

Khi server khởi động, các bước được thực hiện theo thứ tự:

1. **Khởi tạo bảng users**: Tạo tài khoản admin mặc định nếu chưa tồn tại (init-db.js)
2. **Chạy migrations**: Tạo/cập nhật các bảng database
3. **Kích hoạt Scheduler**: Khởi động các job lập lịch
4. **Đồng bộ CGBAS**: Lấy danh sách trạm và thông tin động
5. **Khởi động Web Server**: Lắng nghe kết nối HTTP
6. **Quét eWeLink**: Đồng bộ thiết bị eWeLink lần đầu (chạy bất đồng bộ)

### 3.2. Xử lý HTTP Request

**Middleware Pipeline:**
1. CORS - Cho phép cross-origin requests
2. Body Parser - Parse JSON/URL encoded
3. Static Files - Phục vụ file tĩnh (CSS, JS, Images)
4. Session - Quản lý phiên làm việc (24h timeout)
5. Auth Check - Kiểm tra đăng nhập cho protected routes
6. Route Handler - Xử lý request cụ thể

**Phân loại Route:**
- **Public**: `/login`, `/api/auth/*`, `/redirectUrl` (OAuth callback)
- **Protected**: Dashboard pages (`/dashboard`, `/stations`, `/devices`, ...) và API (`/api/stations/*`, `/api/ewelink/*`, v.v.)

---

## 4. Đồng bộ dữ liệu CGBAS

### 4.1. CGBAS API Service

Hệ thống gọi API CGBAS để lấy dữ liệu trạm với cơ chế xác thực:
- **Access Key (AK)**: Key công khai từ biến môi trường (`X-Access-Key`)
- **Secret Key (SK)**: Key bí mật để tạo signature
- **Signature**: HMAC-SHA256 signature từ method, path, headers (sử dụng utility từ `utils/crypto.js`)

### 4.2. Hai API chính

1. **fetchStations**: Lấy danh sách tất cả trạm
   - Endpoint: `GET /openapi/stream/stations`
   - Tham số: page, size

2. **fetchDynamicInfo**: Lấy thông tin động (trạng thái, vệ tinh, delay)
   - Endpoint: `POST /openapi/stream/stations/dynamic-info`
   - Body: { ids: [station_id...] }

### 4.3. Scheduler đồng bộ

| Tác vụ | Tần suất | Mô tả |
|--------|----------|-------|
| Đồng bộ vệ tinh & kiểm tra phục hồi | 5 giây | Lấy dynamic info và kích hoạt logic phục hồi tự động |
| Đồng bộ danh mục trạm | 1 giờ | Cập nhật danh sách trạm mới từ CGBAS |
| Scheduled Shutdown | 30 giây | Kiểm tra và thực hiện lịch tắt/bật theo lịch hàng ngày |
| Refresh eWeLink Token | 7 ngày (0h chủ nhật) | Tự động làm mới access token |

---

## 5. Cơ chế phục hồi trạm tự động (Auto Recovery)

### 5.1. Auto Monitor - Giám sát và phát hiện (autoMonitor.js)

**Quy trình mỗi 5 giây:**

1. **Cập nhật tracking**: Với mỗi trạm có ánh xạ eWeLink và đang active
   - Nếu online (connectStatus=1): Reset `first_offline_at` và `offline_duration_seconds`
   - Nếu offline/lost data (Status 0, 2, 3): Tích lũy thời gian offline

2. **Tạo job phục hồi** khi đủ điều kiện:
   - Status = 3 (Offline) ≥ 30 giây
   - Status = 2 (Lost Data) ≥ 5 phút (300 giây)
   - Chưa có job đang chạy cho trạm đó
   - Trạm không trong trạng thái scheduled shutdown (pending, shutting_down, waiting_poweron, powering_on)

3. **Chạy job với giới hạn**:
   - Tối đa 10 job chạy đồng thời (RECOVERY_MAX_CONCURRENT_JOBS)
   - Sử dụng MySQL advisory lock để tránh trùng lặp
   - Tự động phục hồi job bị kẹt (RUNNING/CHECKING > 10 phút)

### 5.2. Station Control Service - Thực thi phục hồi (stationControlService.js)

**Kiểm tra trước khi thực thi:**
1. Kiểm tra trạm có đang trong scheduled shutdown không → Bỏ qua nếu có
2. Từ retry thứ 2 trở đi, kiểm tra CGBAS trước → Hoàn thành nếu trạm đã online

**Phân biệt nguyên nhân:**
- **Thiết bị eWeLink OFFLINE**: Nguyên nhân mất điện → Dùng retry chậm: [3, 3, 5, 10, 60, 120] phút
- **Thiết bị eWeLink ONLINE**: Nguyên nhân lỗi phần mềm/treo → Dùng retry nhanh: [2, 2, 3, 5, 10, 20] phút

**Kịch bản phục hồi đầy đủ (Full Scenario):**
1. **STEP 1**: Bật Kênh 1 (Relay 1 - Power) - nếu đang tắt
2. Chờ 10 giây, kiểm tra CGBAS
3. **STEP 2**: Bật Kênh 2 (Relay 2 - Reset) - kích nút reset
4. Chờ 5 giây, kiểm tra CGBAS
5. **STEP 3**: Tắt Kênh 2 - kết thúc kích
6. Chờ 90 giây kiểm tra kết quả cuối cùng

**Xử lý kết quả:**
- Nếu trạm online → Lưu vào history, xóa job, reset tracking
- Nếu trạm vẫn offline → Reschedule với interval phù hợp

**Cơ chế an toàn:**
- Sau 2 lần retry thất bại, tắt Kênh 1 để buộc Hard Reset ở lần sau
- Giới hạn 6 lần thử (MAX_RETRIES), sau đó đánh dấu FAILED và reset tracking để tránh spam job mới
- Kiểm tra CGBAS trước mỗi step để tránh thao tác thừa khi trạm đã phục hồi

---

## 6. Quản lý eWeLink

### 6.1. eWeLink Service (ewelinkService.js)

**Chức năng chính:**
- **getAllThings**: Lấy danh sách thiết bị - tự động quét tất cả Family và phân trang
- **toggleChannel**: Bật/tắt kênh relay theo deviceid, outlet (0 hoặc 1), trạng thái (on/off)
- **forceRefreshToken**: Refresh token ngay lập tức khi 401

**Cơ chế Token Management:**
- Ưu tiên đọc config từ database (bảng ewelink_config)
- Fallback về .env nếu chưa có trong DB
- Axios interceptor tự động thêm token vào request
- Axios interceptor xử lý 401 - tự động refresh token và retry request

### 6.2. OAuth Authentication (ewelinkOAuthService.js)

**Luồng OAuth:**
1. User truy cập `/configs`, click "Đăng nhập eWeLink"
2. Server tạo OAuth URL và trả về cho user
3. User đăng nhập eWeLink và cho phép
4. eWeLink redirect về `/redirectUrl` với authorization code
5. Server exchange code lấy access token + refresh token
6. Lưu tokens vào database (ewelink_config)
7. Redirect về trang configs với thông báo thành công

**Token Refresh:**
- Thủ công: Gọi API `/api/ewelink/refresh-token` hoặc `/api/configs/ewelink`
- Tự động: Scheduler chạy 7 ngày/lần vào 0h chủ nhật

---

## 7. Scheduled Shutdown - Lịch tắt/bật trạm hàng ngày

### 7.1. Cấu hình lịch trình (scheduledShutdownService.js)

Admin cấu hình các tham số:
- **shutdown_time**: Thời gian tắt trạm (định dạng HH:MM:SS)
- **shutdown_duration_minutes**: Thời gian tắt (1-5 phút)
- **batch_size**: Số trạm xử lý mỗi batch (1-20)
- **batch_delay_seconds**: Delay giữa các batch (5-60 giây)
- **is_enabled**: Bật/tắt tính năng

### 7.2. Quy trình thực thi

**Bước 1**: Gắn nhãn (label) cho tất cả trạm đã ánh xạ eWeLink và đang active

**Bước 2**: Tắt tất cả trạm theo batch
- Gọi API eWeLink tắt Kênh 1 (outlet=0)
- Cập nhật trạng thái: pending → shutting_down → waiting_poweron

**Bước 3**: Chờ x phút (shutdown_duration_minutes)

**Bước 4**: Bật lại tất cả trạm theo batch
- Gọi API eWeLink bật Kênh 1 (outlet=0)
- Cập nhật trạng thái: waiting_poweron → powering_on → completed

**Bước 5**: Cập nhật lịch sử, xóa labels

**Tính năng bổ sung:**
- Hủy quy trình đang chạy (cancel)
- Timeout tự động nếu bị stuck (30 phút)
- Chỉ chạy 1 lần mỗi ngày (tránh chạy lại do scheduler)

---

## 8. Database Schema

### Các bảng chính

| Bảng | Mục đích |
|------|----------|
| `users` | Quản lý tài khoản người dùng (username, password bcrypt, role) |
| `stations` | Danh mục trạm RTK từ CGBAS (id, stationName, ewelink_device_id, is_active) |
| `station_dynamic_info` | Thông tin real-time (connectStatus, delay, satellite count, first_offline_at, offline_duration_seconds) |
| `station_recovery_jobs` | Queue job phục hồi đang chạy (station_id, device_id, status, retry_index, next_run_time) |
| `station_recovery_history` | Lịch sử phục hồi (SUCCESS/FAILED/SKIPPED, retry_count, duration, failure_reason) |
| `ewelink_devices` | Thông tin thiết bị eWeLink (deviceid, name, online, model) |
| `ewelink_status` | Trạng thái kênh relay (switch_0, switch_1, voltage_0, current_0, actPow_0) |
| `ewelink_config` | Cấu hình eWeLink (app_id, app_secret, api_url, access_token, refresh_token, token_expiry) |
| `ewelink_api_logs` | Log API calls đến eWeLink (method, endpoint, payload, response_code, duration_ms) |
| `scheduled_shutdown_config` | Cấu hình scheduled shutdown |
| `scheduled_shutdown_labels` | Nhãn theo dõi tiến trình tắt/bật trạm |
| `scheduled_shutdown_history` | Lịch sử thực thi scheduled shutdown |

### Quan hệ giữa các bảng
- `stations` ←→ `station_dynamic_info`: 1-1 (qua stationId)
- `stations` → `station_recovery_jobs`: 1-nhiều (1 trạm có nhiều job trong lịch sử)
- `ewelink_devices` ←→ `ewelink_status`: 1-1 (qua deviceid)
- `stations.ewelink_device_id` → `ewelink_devices.deviceid`: Soft link

---

## 9. API Endpoints

### Authentication (authRoutes.js)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/login` | Đăng nhập với username/password |
| POST | `/api/auth/logout` | Đăng xuất |

### Stations (stationRoutes.js)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/stations/list` | Danh sách trạm có phân trang, tìm kiếm |
| GET | `/api/stations/status` | Danh sách trạm với trạng thái vệ tinh (legacy) |
| POST | `/api/stations/recover` | Thêm trạm vào hàng đợi phục hồi thủ công |
| POST | `/api/stations/update-mapping` | Gán thiết bị eWeLink cho trạm |
| DELETE | `/api/stations/mapping/:stationId` | Xóa ánh xạ eWeLink |
| POST | `/api/stations/toggle-status/:stationId` | Bật/tắt trạm (is_active) |
| POST | `/api/stations/toggle-all` | Bật/tắt tất cả trạm |
| POST | `/api/stations/sync` | Đồng bộ trạm mới từ CGBAS |
| GET | `/api/stations/recovery-stats` | Thống kê phục hồi (tổng quan, top offline, trend 7 ngày) |
| GET | `/api/stations/recovery-history` | Lịch sử phục hồi có phân trang |
| GET | `/api/stations/recovery-history/recent` | 5 bản ghi lịch sử phục hồi gần nhất |

### eWeLink (ewelinkRoutes.js)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/ewelink/devices` | Danh sách thiết bị eWeLink có phân trang, tìm kiếm |
| POST | `/api/ewelink/control` | Điều khiển bật/tắt 1 kênh |
| POST | `/api/ewelink/station-on` | Bật trạm theo kịch bản (Retry 5 lần) |
| POST | `/api/ewelink/station-off` | Tắt trạm theo kịch bản (Retry 5 lần) |
| GET | `/api/ewelink/api-stats` | Thống kê API eWeLink (tổng gọi, theo ngày, logs) |
| GET | `/api/ewelink/token-info` | Xem token hiện tại (đã ẩn một phần) |
| POST | `/api/ewelink/refresh-token` | Force refresh token ngay lập tức |
| GET | `/api/ewelink/auth-url` | Lấy URL đăng nhập OAuth |
| GET | `/api/ewelink/callback` | OAuth callback |
| GET | `/api/ewelink/login-status` | Kiểm tra trạng thái đăng nhập eWeLink |
| POST | `/api/ewelink/sync-devices` | Đồng bộ thiết bị mới từ eWeLink |

### Reports (reportRoutes.js)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/reports/summary` | Thống kê API eWeLink theo period (day/month/year) |
| GET | `/api/reports/by-device` | Thống kê theo thiết bị |

### Config (configRoutes.js)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/configs/ewelink` | Lấy cấu hình eWeLink |
| POST | `/api/configs/ewelink` | Cập nhật cấu hình eWeLink |
| GET | `/api/configs/token-info` | Lấy thông tin token (deprecated) |
| POST | `/api/configs/update-token` | Cập nhật token (deprecated) |
| POST | `/api/configs/test-token` | Test token có hoạt động không |
| POST | `/api/configs/change-password` | Đổi mật khẩu người dùng |

### Scheduled Shutdown (scheduledShutdownRoutes.js)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/scheduled-shutdown/config` | Lấy cấu hình |
| PUT | `/api/scheduled-shutdown/config` | Cập nhật cấu hình |
| GET | `/api/scheduled-shutdown/status` | Lấy trạng thái và lịch sử |
| POST | `/api/scheduled-shutdown/execute` | Thực thi thủ công |
| POST | `/api/scheduled-shutdown/cancel` | Hủy quy trình đang chạy |
| GET | `/api/scheduled-shutdown/stations` | Danh sách trạm theo status |
| GET | `/api/scheduled-shutdown/history` | Lịch sử có phân trang |

---

## 10. Cơ chế bảo mật

### Authentication & Authorization
- Session-based auth với express-session
- Cookie: httpOnly, sameSite=lax, maxAge 24 giờ
- Middleware kiểm tra session trước khi truy cập protected routes
- bcrypt hash cho mật khẩu users

### API Security
- Xác thực signature cho CGBAS API (HMAC-SHA256)
- eWeLink tokens được lưu trong database, không expose ra client
- CORS allow all origins (trong môi trường development)

---

## 11. Logging và Monitoring

### Logger (logger.js)
- Sử dụng Winston
- Log files: `logs/app-YYYY-MM-DD.log`, `logs/error-YYYY-MM-DD.log`
- Rotate hàng ngày
- Log format: timestamp + level + message

### API Logging
- Mọi API call đến eWeLink được ghi vào bảng `ewelink_api_logs`
- Lưu: method, endpoint, payload, response_code, response_body, duration_ms

### Telegram Notification (telegramNotify.js)
- Gửi thông báo qua Telegram Bot khi có sự kiện quan trọng (đổi mật khẩu, lỗi, v.v.)
- Cấu hình qua: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

---

## 12. Deployment

### Docker
- Dockerfile và docker-compose.yml được cấu hình sẵn
- Container: Node.js app + MySQL
- Health check endpoint: `/health`

### Environment Variables chính
```
PORT=3001
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
API_BASE_URL, AK, SK
EWELINK_APPID, EWELINK_APPSECRET, EWELINK_TOKEN, EWELINK_REFRESHTOKEN
SESSION_SECRET
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
```

---

## 13. Tổng kết luồng hoạt động

```
┌─────────────────────────────────────────────────────────────────┐
│                     KHỞI ĐỘNG HỆ THỐNG                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Init DB (users) → 2. Migrations → 3. Scheduler →          │
│  4. Sync CGBAS → 5. Start Server → 6. Sync eWeLink           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SCHEDULER CHẠY 24/7                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  5s      │  │  30s     │  │  1h      │  │  7 days  │       │
│  │ Satellite│  │ Schedule │  │ Station  │  │ Token    │       │
│  │ Recovery │  │ Shutdown │  │ List     │  │ Refresh  │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
└───────┼─────────────┼─────────────┼─────────────┼────────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐
   │ Fetch   │  │ Execute  │  │ Fetch   │  │ Refresh  │
   │ CGBAS   │  │ Schedule │  │ Stations│  │ eWeLink  │
   │ Dynamic │  │ On/Off   │  │ List    │  │ Token    │
   └────┬────┘  └────┬─────┘  └─────────┘  └──────────┘
        │            │
        ▼            │
   ┌──────────────────────────────────┐
   │      AUTO MONITOR (5s)          │
   │  1. Update tracking             │
   │  2. Create recovery jobs        │
   │  3. Execute jobs (max 10)       │
   └──────────────┬───────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────┐
   │   STATION CONTROL SERVICE       │
   │  • Check eWeLink status         │
   │  • Select retry intervals      │
   │  • Execute recovery scenario   │
   │  • Verify result via CGBAS      │
   │  • Reschedule if failed         │
   └──────────────────────────────────┘
```

---

*Document generated: 2026-04-04*
*Dựa trên mã nguồn hiện tại*