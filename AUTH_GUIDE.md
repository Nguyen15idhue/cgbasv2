# 🔐 Hệ thống Authentication CGBAS

## ✅ Đã hoàn thành

### 1. Cơ chế Session (Phiên làm việc)
- ✅ Sử dụng `express-session` để quản lý session
- ✅ Session lưu trên server memory
- ✅ Thời gian hết hạn: **24 giờ**
- ✅ Cookie name: `cgbas_session`
- ✅ HttpOnly cookie để bảo mật

### 2. Middleware `requireAuth` - Cánh cổng kiểm soát
- ✅ Kiểm tra `req.session.user` cho mọi request
- ✅ Phân loại request tự động:
  - **Browser request** → Redirect `/login`
  - **API request** → Trả về `401 JSON`
- ✅ Log mọi hành động vào file `src/logs/app-YYYY-MM-DD.log`

### 3. Cấu trúc Routes

#### Public Routes (Không cần đăng nhập)
- `GET /login` - Trang đăng nhập
- `POST /api/auth/login` - API đăng nhập
- `POST /api/auth/logout` - API đăng xuất
- `GET /api/auth/check` - Kiểm tra trạng thái đăng nhập

#### Protected Routes (Yêu cầu đăng nhập)
- `GET /` - Trang chủ Dashboard
- `GET /api/stations/*` - API quản lý trạm
- `GET /api/ewelink/*` - API điều khiển eWelink

---

## 🚀 Cách sử dụng

### 1. Khởi động server
```bash
node src/main.js
```

### 2. Truy cập hệ thống
- URL: `http://localhost:3000`
- Tự động redirect về `/login` nếu chưa đăng nhập

### 3. Đăng nhập
**Tài khoản mặc định:**
- Username: `admin`
- Password: `admin123`

### 4. Kiểm tra logs
```bash
# Xem log hôm nay
cat src/logs/app-2026-01-10.log

# Xem error logs
cat src/logs/error-2026-01-10.log
```

---

## 📁 Cấu trúc Files

```
src/
├── middleware/
│   └── auth.js              # Middleware requireAuth
├── controllers/
│   └── authController.js    # Logic xử lý login/logout
├── routes/
│   └── authRoutes.js        # Routes authentication
├── views/
│   ├── login.html           # Trang đăng nhập
│   └── index.html           # Dashboard
├── logs/
│   ├── app-YYYY-MM-DD.log   # Application logs
│   └── error-YYYY-MM-DD.log # Error logs
└── utils/
    ├── logger.js            # Winston logger
    └── init-db.js           # Script tạo user admin
```

---

## 🔧 Cấu hình

### File `.env`
```env
SESSION_SECRET=cgbas-super-secret-key-2026-change-me
```
⚠️ **Quan trọng:** Đổi `SESSION_SECRET` trong môi trường production!

---

## 🧪 Test Authentication

### Test API với cURL

**1. Đăng nhập:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt
```

**2. Truy cập API đã bảo vệ:**
```bash
curl http://localhost:3000/api/stations/status \
  -b cookies.txt
```

**3. Đăng xuất:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

---

## 🛡️ Bảo mật

### Đã áp dụng:
- ✅ Mật khẩu mã hóa bằng `bcryptjs` (10 rounds)
- ✅ HttpOnly cookies (Chống XSS)
- ✅ Session timeout 24h
- ✅ Log mọi hoạt động đăng nhập/đăng xuất
- ✅ Middleware phân quyền `requireAdmin` (Sẵn sàng dùng)

### Nên làm thêm (Production):
- [ ] HTTPS (SSL/TLS)
- [ ] Rate limiting cho API login
- [ ] CSRF protection
- [ ] Session store với Redis (thay vì memory)
- [ ] 2FA (Two-Factor Authentication)

---

## 📝 Logs mẫu

```
[2026-01-10 15:30:25] INFO: [Auth] User admin đăng nhập thành công từ ::1
[2026-01-10 15:30:28] INFO: [Auth] User admin truy cập: GET /api/stations/status
[2026-01-10 15:35:12] WARN: [Auth] Truy cập trái phép: GET /api/ewelink/devices từ ::1
[2026-01-10 15:40:00] INFO: [Auth] User admin đã đăng xuất
```

---

## 🆘 Troubleshooting

### Session bị mất sau khi restart server?
➜ Session lưu trên memory, restart server = mất session. Dùng Redis để persistent.

### Cookie không lưu được?
➜ Kiểm tra `secure: false` trong development (không dùng HTTPS)

### Lỗi "Cannot find module bcryptjs"?
➜ Chạy: `npm install bcryptjs`

---

## 👤 Quản lý User

### Tạo user mới (Chạy script hoặc viết API)
```javascript
const bcrypt = require('bcryptjs');
const hashedPassword = await bcrypt.hash('password123', 10);
await db.execute(
  'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)',
  ['newuser', hashedPassword, 'USER', 'Tên người dùng']
);
```

### Đổi mật khẩu
```javascript
const newPassword = await bcrypt.hash('new_password', 10);
await db.execute('UPDATE users SET password = ? WHERE username = ?', 
  [newPassword, 'admin']);
```

---

✨ **Hệ thống authentication đã sẵn sàng hoạt động!**
