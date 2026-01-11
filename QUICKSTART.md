# 🎯 Quick Start Guide - CGBAS Recovery System

## ✅ Đã hoàn thành

### 1. Kiến trúc Frontend
- ✅ Cấu trúc thư mục `public/` (views, css, js, assets)
- ✅ Master Layout với Sidebar + Topbar
- ✅ Responsive design (Mobile-friendly)
- ✅ Bootstrap 5 + FontAwesome 6 + SweetAlert2

### 2. Authentication System
- ✅ Session-based authentication
- ✅ Login page với giao diện hiện đại
- ✅ Middleware `requireAuth` bảo vệ routes
- ✅ Auto redirect cho browser/API requests

### 3. Pages
- ✅ Login page (`/login`)
- ✅ Dashboard (`/dashboard`)
- ✅ Queue Management (`/queue`)

### 4. Features
- ✅ Real-time data refresh
- ✅ Statistics cards
- ✅ Job queue management
- ✅ Beautiful UI/UX
- ✅ Logout confirmation

## 🚀 Cách sử dụng

### 1. Khởi động server
```bash
node src/main.js
```

### 2. Truy cập giao diện
```
http://localhost:3000
```

### 3. Đăng nhập
```
Username: admin
Password: admin123
```

## 📍 Routes

### Public Routes (Không cần đăng nhập)
- `GET /login` - Trang đăng nhập
- `POST /api/auth/login` - API đăng nhập
- `POST /api/auth/logout` - API đăng xuất

### Protected Routes (Cần đăng nhập)
- `GET /` - Redirect to `/dashboard`
- `GET /dashboard` - Dashboard chính
- `GET /queue` - Quản lý hàng đợi
- `GET /api/dashboard/stats` - Lấy thống kê
- `GET /api/queue/jobs` - Lấy danh sách jobs
- `DELETE /api/queue/jobs/:stationId` - Xóa job

## 🎨 Giao diện

### Login Page
![Login](https://via.placeholder.com/800x400/667eea/ffffff?text=Login+Page)
- Split screen design với gradient
- Form validation
- Error handling
- Loading states

### Dashboard
![Dashboard](https://via.placeholder.com/800x400/667eea/ffffff?text=Dashboard)
- 4 stat cards (Online/Offline/Pending/Recovered)
- Real-time updates (30s)
- System status indicators
- Sidebar navigation

### Queue Management
![Queue](https://via.placeholder.com/800x400/667eea/ffffff?text=Queue+Management)
- Real-time job list (10s refresh)
- Status badges
- Cancel job actions
- Empty state design

## 🔧 Cấu trúc Files

```
cgbasv2/
├── public/                  # ← Frontend files (KHÔNG trong src/)
│   ├── views/
│   │   ├── login.html      # Trang đăng nhập
│   │   ├── dashboard.html  # Dashboard
│   │   └── queue.html      # Queue management
│   ├── css/
│   │   └── master.css      # Master layout styles
│   ├── js/
│   │   └── master.js       # Master layout logic
│   └── assets/             # Images, fonts, etc.
│
├── src/                     # Backend code
│   ├── main.js             # Server entry point
│   ├── middleware/
│   │   └── auth.js         # Authentication middleware
│   ├── routes/
│   │   ├── authRoutes.js   # Auth routes
│   │   └── ...
│   └── ...
│
├── .env                     # Environment variables
├── .env.example            # Example env file
├── FRONTEND_GUIDE.md       # Detailed frontend guide
└── package.json
```

## 🎯 Tính năng chính

### Authentication
- ✅ Session-based (24h expiry)
- ✅ Secure cookie
- ✅ Auto redirect on unauthorized
- ✅ Phân biệt Browser vs API requests

### UI Components
- ✅ Collapsible sidebar with localStorage state
- ✅ Topbar with user info
- ✅ Stat cards with hover effects
- ✅ Loading spinners
- ✅ Success/Error notifications
- ✅ Confirmation dialogs

### Data Management
- ✅ Auto-refresh dashboard (30s)
- ✅ Auto-refresh queue (10s)
- ✅ Optimistic UI updates
- ✅ Error handling

## 📱 Responsive

- **Desktop** (> 768px): Sidebar visible
- **Mobile** (≤ 768px): Sidebar collapsible
- **Tablet**: Adaptive layout

## 🎨 Customization

### Colors
Sửa trong `public/css/master.css`:
```css
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --dark-bg: #1a1d2e;
}
```

### Sidebar Width
```css
:root {
    --sidebar-width: 260px;
}
```

## 🐛 Debugging

### Check Server Logs
```bash
# Logs sẽ được ghi vào:
src/logs/app-YYYY-MM-DD.log
src/logs/error-YYYY-MM-DD.log
```

### Common Issues

**Issue: Cannot access pages**
```bash
# Solution: Check if server is running
node src/main.js
```

**Issue: Login doesn't work**
```bash
# Solution: Check database and run init-db
node src/utils/init-db.js
```

**Issue: 401 Unauthorized**
```bash
# Solution: Clear cookies and login again
# Or check session middleware in main.js
```

## 📦 Dependencies

```json
{
  "express": "^5.2.1",
  "express-session": "^1.18.1",
  "bcryptjs": "^2.4.3",
  "winston": "^3.17.0",
  "winston-daily-rotate-file": "^5.0.0",
  "mysql2": "^3.16.0",
  "axios": "^1.13.2",
  "dotenv": "^17.2.3",
  "node-cron": "^4.2.1",
  "crypto-js": "^4.2.0"
}
```

## 🚀 Next Steps

1. **Customize theme** - Thay đổi màu sắc, fonts
2. **Add more pages** - Stations list, Devices list, Logs, Settings
3. **Enhance features** - Real-time notifications, Charts, Export data
4. **Security** - Rate limiting, CSRF protection, Input validation
5. **Production** - Redis session store, Asset minification, HTTPS

## 📞 Support

Nếu cần hỗ trợ, tham khảo:
- `FRONTEND_GUIDE.md` - Chi tiết về frontend
- `readme.md` - Tổng quan hệ thống
- Source code comments

---

**Happy Coding! 🚀**
