# 🚀 CGBAS V2 - Station Recovery System

Hệ thống giám sát và phục hồi tự động cho trạm CGBAS với tích hợp eWelink IoT.

## 📚 Documentation

- **[DEPLOY_VPS.md](DEPLOY_VPS.md)** - Hướng dẫn chi tiết deploy lên VPS Ubuntu
- **[DOCKER_GUIDE.md](DOCKER_GUIDE.md)** - Hướng dẫn sử dụng Docker (dev + prod)
- **[README-DOCKER.md](README-DOCKER.md)** - Quick reference Docker commands

## ✨ Features

- ✅ **Real-time Monitoring** - Giám sát trạm realtime 24/7
- ✅ **Auto Recovery** - Tự động phục hồi khi trạm lỗi
- ✅ **eWelink Integration** - Điều khiển thiết bị IoT từ xa
- ✅ **SPA Architecture** - Không reload page, UX mượt mà
- ✅ **Mobile Responsive** - Hoạt động tốt trên mọi thiết bị
- ✅ **Docker Support** - Deploy dễ dàng với Docker
- ✅ **Production Ready** - Optimized cho production

## 🎯 Tech Stack

- **Backend**: Node.js 20 + Express 5
- **Database**: MySQL 8.0
- **Frontend**: Vanilla JS + Bootstrap 5
- **Deployment**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt

## 🚀 Quick Start

### 1️⃣ Local Development (Windows)

```bash
# Clone repository
git clone https://github.com/Nguyen15idhue/cgbasv2.git
cd cgbasv2

# Install dependencies
npm install

# Setup .env
copy .env.example .env
# Edit .env với thông tin của bạn

# Start development server
npm run dev
```

Mở browser: `http://localhost:3000`

### 2️⃣ Docker Development

```bash
# Windows
docker-start.bat

# Linux/Mac
chmod +x docker-start.sh
./docker-start.sh
```

### 3️⃣ Production Deployment (VPS)

**Xem hướng dẫn chi tiết:** [DEPLOY_VPS.md](DEPLOY_VPS.md)

**Quick setup:**

```bash
# SSH vào VPS
ssh user@your-vps-ip

# Download và chạy setup script
curl -fsSL https://raw.githubusercontent.com/Nguyen15idhue/cgbasv2/main/setup-vps.sh -o setup-vps.sh
chmod +x setup-vps.sh
./setup-vps.sh

# Edit environment
cd /opt/cgbasv2
nano .env

# Start production
docker-compose --profile prod up -d

# Check logs
docker-compose logs -f
```

## 📦 Project Structure

```
cgbasv2/
├── src/
│   ├── main.js              # Entry point
│   ├── config/              # Database config
│   ├── controllers/         # Business logic
│   ├── middleware/          # Auth, logging
│   ├── migrations/          # Database migrations
│   ├── repository/          # Data access layer
│   ├── routes/              # API routes
│   ├── services/            # External services
│   └── utils/               # Helpers, logger, scheduler
├── public/
│   ├── index.html           # SPA shell
│   ├── css/                 # Stylesheets
│   ├── js/                  # Client-side JS
│   │   ├── router.js        # SPA routing
│   │   └── master.js        # Global functions
│   └── partials/            # Page templates
├── docs/                    # Documentation
├── Dockerfile               # Multi-stage Docker build
├── docker-compose.yml       # Dev + Prod profiles
├── .env.example             # Environment template
└── package.json
```

## 🔧 Environment Variables

```bash
# Database
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=cgbas_db

# Session
SESSION_SECRET=your-secret-key

# CGBAS API
AK=your_access_key
SK=your_secret_key
API_BASE_URL=http://api-url:8090

# Ewelink
EWELINK_APPID=your_appid
EWELINK_APPSECRET=your_secret
EWELINK_TOKEN=your_token
EWELINK_REFRESHTOKEN=your_refresh_token
EWELINK_API=https://as-apia.coolkit.cc
```

## 🐳 Docker Commands

```bash
# Development
docker-compose --profile dev up -d

# Production
docker-compose --profile prod up -d

# Logs
docker-compose logs -f

# Stats
docker stats

# Stop
docker-compose down
```

## 📊 API Endpoints

### Public
- `GET /login` - Login page
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Protected (Requires authentication)
- `GET /health` - Health check
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/stations/list` - List all stations
- `GET /api/ewelink/devices` - List eWelink devices
- `GET /api/queue/jobs` - Recovery queue
- `GET /api/ewelink/api-stats` - API logs
- `POST /api/stations/update-mapping` - Map station to device

## 🔐 Default Credentials

```
Username: admin
Password: admin123
```

⚠️ **IMPORTANT**: Đổi password ngay sau lần đăng nhập đầu tiên!

## 🎨 Pages

- **Dashboard** - Tổng quan hệ thống
- **Queue** - Hàng đợi phục hồi
- **Stations** - Danh sách trạm CGBAS
- **Devices** - Thiết bị eWelink
- **Logs** - Nhật ký API
- **Settings** - Ánh xạ trạm - thiết bị

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Server sẽ chạy tại http://localhost:3000
```

## 🚢 Deployment

### Option 1: Docker (Recommended)

Xem [DOCKER_GUIDE.md](DOCKER_GUIDE.md)

### Option 2: VPS Manual

Xem [DEPLOY_VPS.md](DEPLOY_VPS.md)

### Option 3: VPS Auto Setup

```bash
# Download script
wget https://raw.githubusercontent.com/Nguyen15idhue/cgbasv2/main/setup-vps.sh

# Run
chmod +x setup-vps.sh
./setup-vps.sh
```

## 📈 Performance

- **Image Size**: ~150MB (production)
- **Memory**: ~256MB (idle), ~512MB (peak)
- **CPU**: 0.5-1 core
- **Startup**: ~3 seconds

## 🔄 Update Production

```bash
# SSH vào VPS
ssh user@your-vps

# Chạy update script
cd /opt/cgbasv2
./update-vps.sh
```

Script sẽ tự động:
1. Pull latest code
2. Backup database
3. Rebuild image
4. Restart containers
5. Verify health

## 🔒 Security Features

- ✅ Session-based authentication
- ✅ Non-root user in Docker
- ✅ Environment variables for secrets
- ✅ CORS protection
- ✅ SQL injection prevention
- ✅ XSS protection headers
- ✅ HTTPS with Let's Encrypt

## 📝 License

MIT License - Free to use

## 👨‍💻 Author

Nguyen15idhue

## 🤝 Contributing

Pull requests are welcome!

## 📞 Support

- GitHub Issues: [Create an issue](https://github.com/Nguyen15idhue/cgbasv2/issues)
- Documentation: [Wiki](https://github.com/Nguyen15idhue/cgbasv2/wiki)

## 🎉 Changelog

### v2.0.0 (2026-01-12)
- ✨ Convert to SPA architecture
- 📱 Mobile responsive UI
- 🐳 Docker support
- 🚀 Production deployment guide
- 🔧 Auto-setup scripts

### v1.0.0 (Initial)
- Basic station monitoring
- eWelink integration
- Auto recovery system

---

**⭐ Star this repo if you find it useful!**

Made with ❤️ by CGBAS Team
