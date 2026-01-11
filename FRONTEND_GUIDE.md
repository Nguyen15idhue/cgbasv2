# 🚀 CGBAS Recovery System - Frontend Guide

## 📋 Tổng quan

Hệ thống giao diện Web App hiện đại với kiến trúc Master Layout, sử dụng:
- **Bootstrap 5** - Responsive framework
- **FontAwesome 6** - Icon library
- **SweetAlert2** - Beautiful alerts
- **Google Fonts (Inter)** - Modern typography

## 📁 Cấu trúc Frontend

```
public/
├── views/          # Các trang HTML
│   ├── login.html      # Trang đăng nhập
│   ├── dashboard.html  # Dashboard chính
│   └── queue.html      # Quản lý hàng đợi
├── css/            # Stylesheets
│   └── master.css      # Master layout CSS
├── js/             # JavaScript files
│   └── master.js       # Master layout logic
└── assets/         # Images, fonts, etc.
```

## 🎨 Master Layout

### Cấu trúc Layout

```
┌─────────────────────────────────────────┐
│              TOPBAR                     │
│  [☰] Dashboard      [User] [Logout]   │
├──────────┬──────────────────────────────┤
│          │                              │
│ SIDEBAR  │    MAIN CONTENT             │
│          │                              │
│ [Home]   │                              │
│ [Queue]  │                              │
│ [Logs]   │                              │
│          │                              │
└──────────┴──────────────────────────────┘
```

### Sidebar
- **Fixed position** (cố định bên trái)
- **Width**: 260px
- **Dark theme** với gradient accent
- **Collapsible** (có thể ẩn/hiện)
- **Active state** tự động theo URL

### Topbar
- **Fixed position** (cố định trên cùng)
- **Height**: 65px
- Nút toggle sidebar
- Thông tin user
- Nút logout với confirmation

## 🔐 Authentication Flow

### 1. Login Process
```
User -> Login Page -> POST /api/auth/login -> Verify credentials
                                            -> Create session
                                            -> Redirect to /dashboard
```

### 2. Protected Routes
Tất cả các trang và API đều được bảo vệ bởi middleware `requireAuth`:

**Phân loại request:**
- **Browser request** → Redirect to `/login`
- **API request** → Return JSON 401

### 3. Session Management
- **Duration**: 24 giờ
- **Storage**: Server memory (có thể chuyển sang Redis)
- **Cookie name**: `cgbas_session`
- **Auto logout**: Khi session hết hạn

## 🎯 Các trang chính

### 1. Login Page (`/login`)
- **Features:**
  - Split screen design (Beautiful gradient)
  - Form validation
  - Error messages
  - Loading states
  - Auto-redirect if logged in

- **Default credentials:**
  ```
  Username: admin
  Password: admin123
  ```

### 2. Dashboard (`/dashboard`)
- **Features:**
  - 4 stat cards (Online/Offline/Pending/Recovered)
  - Real-time data (refresh every 30s)
  - System status indicators
  - Recent activities timeline

- **API Endpoints:**
  ```
  GET /api/dashboard/stats
  Response: {
    onlineStations: number,
    offlineStations: number,
    pendingJobs: number,
    recoveredToday: number,
    user: { username, role }
  }
  ```

### 3. Queue Management (`/queue`)
- **Features:**
  - Real-time job list (refresh every 10s)
  - Job status badges
  - Cancel job action
  - Empty state design
  - Retry counter display

- **API Endpoints:**
  ```
  GET /api/queue/jobs
  DELETE /api/queue/jobs/:stationId
  ```

## 🛠️ JavaScript Utilities

### Master.js Functions

```javascript
// Show loading spinner
showLoading('Đang tải...');

// Hide loading
hideLoading();

// Show success message
showSuccess('Thành công!');

// Show error message
showError('Có lỗi xảy ra');

// Confirmation dialog
const confirmed = await confirmAction('Bạn có chắc?');
if (confirmed) {
    // Do something
}
```

### Sidebar State Management
```javascript
// Sidebar state được lưu trong localStorage
// Key: 'sidebarCollapsed'
// Value: 'true' | 'false'
```

## 📱 Responsive Design

### Breakpoints
- **Desktop**: > 768px - Sidebar visible
- **Tablet/Mobile**: ≤ 768px - Sidebar hidden by default

### Mobile Behavior
- Sidebar collapses automatically
- User details hidden in topbar
- Touch-friendly buttons
- Overlay sidebar on toggle

## 🎨 Customization

### Color Scheme
```css
:root {
    --primary-color: #667eea;      /* Primary brand color */
    --secondary-color: #764ba2;    /* Secondary accent */
    --dark-bg: #1a1d2e;           /* Sidebar background */
    --darker-bg: #151824;          /* Sidebar header */
    --text-light: #e0e0e0;        /* Light text */
    --text-muted: #a0a0a0;        /* Muted text */
}
```

### Modifying Sidebar Width
```css
:root {
    --sidebar-width: 260px;  /* Change this value */
}
```

### Modifying Topbar Height
```css
:root {
    --topbar-height: 65px;  /* Change this value */
}
```

## 🔧 Development Tips

### 1. Adding New Pages
```html
<!-- Copy dashboard.html template -->
<!-- Update:
  - Page title
  - Active menu item
  - Page content
  - API endpoints
-->
```

### 2. Adding New Menu Items
```html
<a href="/new-page" class="menu-item">
    <i class="fas fa-icon"></i>
    <span>New Page</span>
</a>
```

### 3. Adding New API Routes
```javascript
// In src/main.js
app.get('/api/new-endpoint', requireAuth, async (req, res) => {
    // Your logic here
});
```

## 🚀 Deployment Checklist

- [ ] Change `SESSION_SECRET` in `.env`
- [ ] Enable HTTPS for production
- [ ] Update `secure: true` in session config
- [ ] Optimize assets (minify CSS/JS)
- [ ] Enable CORS if needed
- [ ] Setup Redis for session storage
- [ ] Configure reverse proxy (Nginx)

## 📝 Notes

1. **Không có file frontend trong `src/`**: Tất cả frontend files nằm trong `public/`
2. **Session-based auth**: Không dùng JWT, dùng session cookie
3. **Auto-refresh data**: Dashboard/Queue tự động refresh
4. **Responsive first**: Mobile-friendly từ đầu
5. **Modern UI**: Gradient, shadows, smooth transitions

## 🐛 Common Issues

### Issue: Sidebar không ẩn/hiện
**Solution**: Kiểm tra `master.js` đã load chưa

### Issue: Login redirect loop
**Solution**: Clear cookies và session

### Issue: CSS không load
**Solution**: Kiểm tra đường dẫn static files trong `main.js`

### Issue: API 401 Unauthorized
**Solution**: Kiểm tra session middleware và requireAuth

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-10
