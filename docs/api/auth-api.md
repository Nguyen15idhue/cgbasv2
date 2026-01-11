# 🔐 Authentication API

API xác thực người dùng và quản lý session.

---

## Base URL

```
http://localhost:3000/api/auth
```

---

## 1. Đăng nhập

### `POST /login`

Xác thực người dùng và tạo session.

#### Request

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_password"
}
```

#### Response - Success (200)

```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "user": {
    "username": "admin",
    "role": "admin",
    "full_name": "Administrator"
  }
}
```

#### Response - Failed (401)

```json
{
  "success": false,
  "message": "Tên đăng nhập hoặc mật khẩu không đúng"
}
```

#### Response - Missing Fields (400)

```json
{
  "success": false,
  "message": "Vui lòng nhập đầy đủ thông tin"
}
```

#### Headers Response

```
Set-Cookie: cgbas_session=<session-id>; Path=/; HttpOnly; Max-Age=86400
```

Session cookie có hiệu lực **24 giờ**.

---

## 2. Đăng xuất

### `POST /logout`

Hủy session hiện tại.

#### Request

```http
POST /api/auth/logout
Cookie: cgbas_session=<session-id>
```

#### Response - Success (200)

```json
{
  "success": true,
  "message": "Đăng xuất thành công"
}
```

#### Response - Error (500)

```json
{
  "success": false,
  "message": "Lỗi khi đăng xuất"
}
```

---

## 3. Kiểm tra Session

### Middleware `requireAuth`

Tất cả protected routes đều yêu cầu session hợp lệ.

#### Request Headers

```http
Cookie: cgbas_session=<session-id>
```

#### Response - Unauthorized (401)

**API Request:**
```json
{
  "success": false,
  "message": "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.",
  "code": "UNAUTHORIZED"
}
```

**Browser Request:**
```
HTTP/1.1 302 Found
Location: /login
```

---

## Session Management

### Cookie Configuration

```javascript
{
  name: 'cgbas_session',
  maxAge: 24 * 60 * 60 * 1000, // 24 giờ
  httpOnly: true,
  secure: false,  // true trong production với HTTPS
  sameSite: 'lax'
}
```

### Session Data Structure

```javascript
{
  user: {
    id: 1,
    username: "admin",
    role: "admin",
    full_name: "Administrator"
  }
}
```

---

## Security Notes

### Password Hashing

- Sử dụng **bcryptjs** với salt rounds = 10
- Password không bao giờ được lưu dạng plaintext

### Session Storage

- Session lưu trong memory (production nên dùng Redis)
- Session tự động expire sau 24 giờ
- Session bị xóa khi logout

### CSRF Protection

- Hiện tại: Không implement (API-first design)
- Production: Nên thêm CSRF tokens cho form-based requests

---

## Examples

### JavaScript (Fetch API)

```javascript
// Login
async function login(username, password) {
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include', // Important: Gửi cookie
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  return data;
}

// Logout
async function logout() {
  const response = await fetch('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  
  return await response.json();
}
```

### cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' \
  -c cookies.txt

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

---

## Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| 200 | OK | Đăng nhập/đăng xuất thành công |
| 400 | Bad Request | Thiếu thông tin bắt buộc |
| 401 | Unauthorized | Sai username/password hoặc session hết hạn |
| 500 | Internal Server Error | Lỗi hệ thống |

---

**Related:**
- [Stations API](./stations-api.md)
- [eWelink API](./ewelink-api.md)
- [Security Guide](../guides/security.md)
