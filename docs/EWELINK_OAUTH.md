# eWeLink OAuth Token Integration

## Tổng quan

Tài liệu mô tả chức năng đăng nhập eWeLink OAuth, lấy token và tự động làm mới token mỗi 7 ngày.

## Luồng hoạt động

### 1. Đăng nhập OAuth

```
User → Web UI (Đăng nhập eWeLink) → API /auth-url 
→ eWeLink OAuth Page → User đăng nhập 
→ Callback /redirectUrl → Lưu token vào DB
```

### 2. Token Storage

- **Nơi lưu**: Database `ewelink_config` table
- **Các trường**:
  - `access_token`: Token truy cập
  - `refresh_token`: Token làm mới
  - `token_expiry`: Thời hạn access token (DATETIME)
  - `refresh_token_expiry`: Thời hạn refresh token (DATETIME)

### 3. Auto Refresh (7 ngày)

- Cron job chạy vào **0h Chủ Nhật hàng tuần**
- Sử dụng `ewelink-api-next` library để refresh token

## Các API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/ewelink/auth-url` | Lấy URL OAuth để đăng nhập |
| GET | `/api/ewelink/callback` | OAuth callback - lưu token |
| GET | `/api/ewelink/login-status` | Kiểm tra trạng thái đăng nhập |
| POST | `/api/ewelink/refresh-token` | Refresh token thủ công |

## Database Schema

```sql
CREATE TABLE ewelink_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    app_id VARCHAR(255),
    app_secret VARCHAR(255),
    api_url VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expiry DATETIME,
    refresh_token_expiry DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Các file đã sửa/tạo

### 1. Services
- `src/services/ewelinkOAuthService.js` - OAuth service mới
  - `getConfigFromDB()` - Lấy config từ DB
  - `saveTokensToDB()` - Lưu token vào DB
  - `refreshToken()` - Refresh token
  - `autoRefreshToken()` - Tự động refresh

### 2. Routes
- `src/routes/ewelinkRoutes.js` - Thêm OAuth endpoints
  - `/auth-url` - Tạo login URL
  - `/callback` - OAuth callback
  - `/login-status` - Kiểm tra trạng thái
  - `/refresh-token` - Refresh thủ công

### 3. Scheduler
- `src/utils/scheduler.js` - Thêm cron job refresh token 7 ngày

### 4. Frontend
- `public/partials/configs.html` - Thêm UI đăng nhập OAuth
- `public/js/configs.js` - Thêm xử lý OAuth

### 5. Dependencies
- `package.json` - Thêm `ewelink-api-next`

## Sử dụng

### Bước 1: Cấu hình App ID và App Secret
Vào trang Cấu hình → Nhập App ID và App Secret → Lưu

### Bước 2: Đăng nhập eWeLink
Bấm nút **"Đăng nhập eWeLink"** → Đăng nhập trong tab mới → Token được lưu tự động

### Bước 3: Refresh thủ công (nếu cần)
Bấm nút **"Refresh Token"** để refresh ngay lập tức

## Cấu hình môi trường

Các biến môi trường trong `.env`:
```
EWELINK_APPID=your_app_id
EWELINK_APPSECRET=your_app_secret
EWELINK_API=https://as-apia.coolkit.cc
```

## Token Expiry

- **Access Token**: 30 ngày
- **Refresh Token**: 60 ngày

## Lưu ý

1. Token được lưu vào database thay vì file JSON
2. Token tự động refresh mỗi 7 ngày (vào Chủ Nhật)
3. Sử dụng thư viện `ewelink-api-next` chính thức để đảm bảo tương thích
4. Frontend hiển thị trạng thái đăng nhập và thời hạn token
