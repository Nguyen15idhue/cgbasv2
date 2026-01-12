# 🔄 eWelink Token Auto-Refresh

## Tổng quan

Hệ thống đã được nâng cấp với **cơ chế tự động làm mới token** khi eWelink access token hết hạn. Điều này đảm bảo hệ thống hoạt động liên tục mà không cần can thiệp thủ công.

## 🔐 Cơ chế hoạt động

### 1. **Auto-Refresh Token**

Khi gọi API eWelink và nhận được lỗi `401 Unauthorized` (token hết hạn):
- Hệ thống tự động gọi API refresh token
- Sử dụng `EWELINK_REFRESHTOKEN` để lấy access token mới
- Retry request ban đầu với token mới
- Không làm gián đoạn hoạt động của ứng dụng

### 2. **Token Storage**

Token được lưu trong memory và tự động cập nhật khi refresh:
```javascript
currentAccessToken  // Token hiện đang dùng
currentRefreshToken // Refresh token để lấy token mới
```

### 3. **Race Condition Prevention**

Nếu nhiều request cùng lúc gặp lỗi 401:
- Chỉ 1 request thực hiện refresh
- Các request khác chờ refresh xong
- Tất cả retry với token mới

## 📡 API Endpoints

### 1. Xem thông tin token hiện tại

```bash
GET /api/ewelink/token-info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "37f5958d6b...5ca6790ed0",
    "refreshToken": "1c7dd2cce9...ccee85d787",
    "note": "Token được tự động làm mới khi hết hạn"
  }
}
```

### 2. Force refresh token ngay lập tức

```bash
POST /api/ewelink/refresh-token
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Token đã được làm mới thành công",
  "data": {
    "newAccessToken": "abc123...",
    "newRefreshToken": "xyz789...",
    "note": "Vui lòng cập nhật token mới vào file .env để lưu vĩnh viễn"
  }
}
```

**Response (Failed):**
```json
{
  "success": false,
  "message": "Không thể làm mới token: ...",
  "note": "Token có thể đã hết hạn hoàn toàn. Vui lòng lấy token mới từ eWelink app."
}
```

## 📝 Logs

Khi token được refresh, hệ thống sẽ ghi log:

```
[15:27:33 12/01/2026] info: [eWelink] Token hết hạn, đang làm mới...
[15:27:34 12/01/2026] info: [eWelink] ✅ Làm mới token thành công!
[15:27:34 12/01/2026] warn: [eWelink] ⚠️  Vui lòng cập nhật .env với token mới:
[15:27:34 12/01/2026] warn: EWELINK_TOKEN=new_access_token_here
[15:27:34 12/01/2026] warn: EWELINK_REFRESHTOKEN=new_refresh_token_here
```

## ⚙️ Cấu hình

Đảm bảo file `.env` có đầy đủ thông tin:

```env
# eWelink API
EWELINK_APPID=your_appid
EWELINK_APPSECRET=your_appsecret
EWELINK_TOKEN=your_access_token
EWELINK_REFRESHTOKEN=your_refresh_token    # QUAN TRỌNG!
EWELINK_API=https://as-apia.coolkit.cc
```

## 🔧 Cập nhật token mới vào .env

Khi token được refresh, làm theo các bước:

### Bước 1: Xem token mới trong logs

```bash
docker-compose logs app-dev | grep "EWELINK_TOKEN"
```

### Bước 2: Cập nhật vào file .env

```bash
nano .env
```

Thay thế giá trị cũ bằng token mới.

### Bước 3: Không cần restart

Token trong memory đã được cập nhật tự động. Chỉ cần cập nhật `.env` để lưu vĩnh viễn cho lần restart sau.

## 🚨 Xử lý lỗi

### Trường hợp 1: Token và Refresh Token đều hết hạn

**Triệu chứng:**
- Logs hiển thị: `❌ Lỗi refresh token`
- API trả về lỗi liên tục

**Giải pháp:**
1. Lấy token mới từ eWelink mobile app
2. Cập nhật vào `.env`:
   ```env
   EWELINK_TOKEN=new_token
   EWELINK_REFRESHTOKEN=new_refresh_token
   ```
3. Restart container:
   ```bash
   docker-compose restart app-dev
   ```

### Trường hợp 2: Refresh token không hợp lệ

**Triệu chứng:**
- Response: `"error": 403` hoặc `"invalid refresh token"`

**Giải pháp:**
- Lấy cặp token mới từ eWelink app
- Cập nhật cả `EWELINK_TOKEN` và `EWELINK_REFRESHTOKEN`

## 📱 Lấy token mới từ eWelink App

### Cách 1: Sử dụng API Login

```bash
curl -X POST "https://as-apia.coolkit.cc/v2/user/login" \
  -H "Content-Type: application/json" \
  -H "X-CK-Appid: YOUR_APPID" \
  -d '{
    "countryCode": "+84",
    "phoneNumber": "0123456789",
    "password": "your_password"
  }'
```

Response sẽ chứa `at` (access token) và `rt` (refresh token).

### Cách 2: Sử dụng eWelink Developer Tools

1. Truy cập [eWeLink Developer](https://dev.ewelink.cc/)
2. Login với tài khoản eWelink
3. Vào "API Testing" để lấy token

## 🔍 Monitoring

### Kiểm tra token status

```bash
# Xem token info
curl http://localhost:3000/api/ewelink/token-info

# Force refresh để test
curl -X POST http://localhost:3000/api/ewelink/refresh-token
```

### Xem API logs

```bash
# Xem logs realtime
docker-compose logs -f app-dev | grep eWelink

# Xem API stats
curl http://localhost:3000/api/ewelink/api-stats
```

## ✅ Best Practices

1. **Luôn cập nhật EWELINK_REFRESHTOKEN** trong file `.env`
2. **Monitoring logs** để phát hiện sớm khi token cần làm mới
3. **Backup token** khi có token mới (lưu vào file secure)
4. **Set reminder** để lấy token mới trước khi refresh token hết hạn hoàn toàn
5. **Test định kỳ** API refresh token để đảm bảo hoạt động tốt

## 📊 Token Lifecycle

```
Token mới (90 ngày)
    ↓
Sử dụng bình thường
    ↓
Token hết hạn (401)
    ↓
Auto refresh token
    ↓
Lấy token mới + refresh token mới
    ↓
Cập nhật memory
    ↓
Log warning → Admin cập nhật .env
    ↓
Tiếp tục hoạt động
```

## 🛡️ Security Notes

- Token được hiển thị một phần trong API response (10 ký tự đầu và cuối)
- Full token chỉ hiển thị trong logs của server
- Không bao giờ expose token trong public API
- Bảo vệ file `.env` với quyền `chmod 600`

---

**Tóm lại:** Hệ thống giờ đã tự động xử lý token hết hạn, bạn chỉ cần theo dõi logs và cập nhật `.env` khi có token mới! 🎉
