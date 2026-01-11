# 📚 CGBAS v2 - Documentation

Hệ thống Quản lý và Phục hồi Trạm RTK Tự động

---

## 📖 Tổng quan

CGBAS v2 là hệ thống tích hợp giữa CGBAS PRO API và eWelink IoT để tự động giám sát và phục hồi các trạm RTK khi gặp sự cố offline.

### Tính năng chính

- ✅ **Giám sát realtime** - Đồng bộ trạng thái trạm mỗi 15 giây
- 🔄 **Phục hồi tự động** - Tự động kích hoạt thiết bị eWelink khi phát hiện offline
- 📊 **Quản lý lịch sử** - Lưu trữ đầy đủ lịch sử phục hồi với thống kê
- 🔐 **Bảo mật** - Xác thực session-based với bcrypt
- 📱 **Dashboard** - Giao diện web quản lý trực quan
- 🔧 **API REST** - API đầy đủ cho tích hợp bên ngoài

---

## 📂 Cấu trúc Documentation

### 1. **API Documentation** (`/docs/api/`)
- [Authentication API](./api/auth-api.md) - Đăng nhập, đăng xuất, session
- [Stations API](./api/stations-api.md) - Quản lý trạm RTK
- [eWelink API](./api/ewelink-api.md) - Điều khiển thiết bị IoT
- [Recovery API](./api/recovery-api.md) - Phục hồi tự động và lịch sử

### 2. **Architecture** (`/docs/architecture/`)
- [System Overview](./architecture/system-overview.md) - Kiến trúc tổng quan
- [Data Flow](./architecture/data-flow.md) - Luồng dữ liệu
- [Recovery Mechanism](./architecture/recovery-mechanism.md) - Cơ chế phục hồi chi tiết
- [Retry Strategy](./architecture/retry-strategy.md) - Chiến lược retry

### 3. **Database** (`/docs/database/`)
- [Schema Overview](./database/schema.md) - Tổng quan database schema
- [Tables Reference](./database/tables.md) - Chi tiết các bảng
- [Relationships](./database/relationships.md) - Quan hệ giữa các bảng
- [Migrations](./database/migrations.md) - Quản lý migration

### 4. **Guides** (`/docs/guides/`)
- [Installation Guide](./guides/installation.md) - Hướng dẫn cài đặt
- [Configuration Guide](./guides/configuration.md) - Cấu hình hệ thống
- [Deployment Guide](./guides/deployment.md) - Deploy production
- [Development Guide](./guides/development.md) - Hướng dẫn phát triển
- [Troubleshooting](./guides/troubleshooting.md) - Xử lý sự cố

---

## 🚀 Quick Start

```bash
# 1. Clone project
git clone <repository-url>
cd cgbasv2

# 2. Install dependencies
npm install

# 3. Cấu hình .env
cp .env.example .env
# Chỉnh sửa .env với thông tin của bạn

# 4. Run migrations
node src/migrations/index.js

# 5. Start server
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

---

## 🔧 Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: MySQL 8.0+
- **Authentication**: bcryptjs + express-session
- **Logging**: Winston
- **Scheduling**: node-cron
- **API Integration**: Axios (CGBAS PRO, eWelink)

---

## 📊 System Status

### Health Check

```bash
GET http://localhost:3000/api/dashboard/stats
```

### Logs

```bash
# Application logs
tail -f src/logs/app-YYYY-MM-DD.log

# Error logs
tail -f src/logs/error-YYYY-MM-DD.log
```

---

## 🤝 Contributing

Vui lòng đọc [Development Guide](./guides/development.md) trước khi contribute.

---

## 📧 Support

- Email: support@cgbas.com
- Documentation: https://docs.cgbas.com

---

**Phiên bản**: 1.0.0  
**Cập nhật**: January 11, 2026
