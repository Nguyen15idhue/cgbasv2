# Hướng Dẫn Migrate Cấu Hình eWeLink Từ .env Sang Database

## Tổng quan
Toàn bộ cấu hình eWeLink (App ID, App Secret, API URL, Tokens) đã được chuyển từ file `.env` sang database để quản lý tập trung và dễ dàng cập nhật qua giao diện web.

## Các Bước Thực Hiện

### Bước 1: Chạy Migration Database

```bash
# Chạy migration để tạo bảng ewelink_config
node src/utils/init-db.js
```

Migration mới `009_create_ewelink_config.sql` sẽ tạo bảng `ewelink_config` với trigger đảm bảo chỉ có 1 bản ghi duy nhất.

### Bước 2: Migrate Dữ Liệu Từ .env Sang DB

```bash
# Chạy script migrate một lần
node src/utils/migrate-ewelink-to-db.js
```

Script này sẽ:
- Đọc cấu hình từ `.env` (EWELINK_APPID, EWELINK_APPSECRET, EWELINK_API, EWELINK_TOKEN, EWELINK_REFRESHTOKEN)
- Lưu vào bảng `ewelink_config` trong database
- Hiển thị xác nhận

### Bước 3: Restart Ứng Dụng

```bash
# Nếu đang chạy Docker
docker-compose restart app

# Hoặc nếu chạy local
# Ctrl+C và chạy lại: node src/main.js
```

## Các Thay Đổi Chính

### 1. Database
- **Bảng mới**: `ewelink_config` 
  - `app_id`: App ID từ eWeLink
  - `app_secret`: App Secret từ eWeLink
  - `api_url`: URL API eWeLink
  - `access_token`: Token hiện tại
  - `refresh_token`: Refresh token
  - `token_expiry`: Thời gian hết hạn access token
  - `refresh_token_expiry`: Thời gian hết hạn refresh token

### 2. Backend (`ewelinkService.js`)
- ✅ Đọc cấu hình từ DB thay vì `process.env`
- ✅ Tự động load config khi khởi động
- ✅ Lưu token mới vào DB khi auto-refresh
- ✅ Hàm `updateConfig()` để cập nhật runtime

### 3. API Routes (`configRoutes.js`)
- ✅ `GET /api/configs/ewelink` - Lấy toàn bộ cấu hình
- ✅ `POST /api/configs/ewelink` - Cập nhật cấu hình
- ⚠️ `GET /api/configs/token-info` - DEPRECATED, vẫn hoạt động
- ⚠️ `POST /api/configs/update-token` - DEPRECATED, vẫn hoạt động

### 4. Frontend
- ✅ Trang cấu hình hiển thị đầy đủ: App ID, App Secret, API URL, Tokens
- ✅ Form cập nhật toàn bộ cấu hình
- ✅ Kiểm tra token sắp hết hạn
- ✅ Test token trước khi lưu

## Sử Dụng Giao Diện Web

1. Đăng nhập vào hệ thống
2. Vào menu **Cấu Hình** (Settings)
3. Xem mục **"Cấu Hình eWeLink"**
4. Điền đầy đủ thông tin:
   - App ID
   - App Secret
   - API URL (mặc định: https://as-apia.coolkit.cc)
   - Access Token (tùy chọn)
   - Refresh Token (tùy chọn)
5. Nhấn **"Cập Nhật Cấu Hình"**

## Lưu Ý Quan Trọng

### Auto-Refresh Token
- Khi token hết hạn, hệ thống tự động refresh và **LƯU VÀO DB**
- Không cần cập nhật thủ công file `.env` nữa
- Log sẽ ghi: `[eWelink] ✅ Token mới đã được lưu vào database`

### Fallback Mechanism
- Nếu DB chưa có config, hệ thống tự động fallback về `.env`
- Đảm bảo tương thích ngược

### File .env
- **Không cần xóa** các biến `EWELINK_*` trong `.env`
- Chúng chỉ dùng làm fallback khi DB chưa có dữ liệu
- Config trong DB sẽ được ưu tiên

## Kiểm Tra Config Hiện Tại

```javascript
// Mở Console và chạy:
const ewelinkService = require('./src/services/ewelinkService');
console.log(ewelinkService.getCurrentTokens());
```

Hoặc xem trong giao diện web tại trang **Cấu Hình**.

## Troubleshooting

### Lỗi: "Thiếu EWELINK_APPID"
- Chưa chạy migrate, chạy: `node src/utils/migrate-ewelink-to-db.js`
- Hoặc nhập thủ công qua giao diện web

### Token tự động refresh nhưng không lưu DB
- Kiểm tra log: `[eWelink] Lỗi lưu token vào DB: ...`
- Đảm bảo bảng `ewelink_config` đã tồn tại
- Chạy lại migration nếu cần

### Config trong web không cập nhật
- Xóa cache trình duyệt
- Kiểm tra API response: `GET /api/configs/ewelink`
- Restart ứng dụng

## Kết Luận

✅ **Hoàn tất**: Toàn bộ config eWeLink đã được chuyển sang quản lý bằng database  
✅ **Dễ quản lý**: Cập nhật qua giao diện web, không cần sửa file  
✅ **Tự động**: Token được refresh và lưu tự động  
✅ **An toàn**: Trigger đảm bảo chỉ 1 config duy nhất  

🎉 **Bây giờ bạn có thể quản lý cấu hình eWeLink hoàn toàn qua web!**
