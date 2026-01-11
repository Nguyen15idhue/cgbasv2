# 📦 Installation Guide

Hướng dẫn cài đặt CGBAS v2 trên môi trường development.

---

## System Requirements

### Minimum Requirements

- **OS**: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)
- **Node.js**: 18.0.0 or higher
- **MySQL**: 8.0 or higher
- **RAM**: 2GB minimum
- **Disk**: 5GB free space

### Recommended

- **Node.js**: 18.x LTS
- **MySQL**: 8.0.x
- **RAM**: 4GB+
- **Disk**: 10GB+ SSD

---

## Prerequisites Installation

### 1. Install Node.js

#### Windows

Download và cài đặt từ: https://nodejs.org/

```powershell
# Verify installation
node -v
npm -v
```

#### macOS

```bash
# Using Homebrew
brew install node@18

# Verify
node -v
npm -v
```

#### Linux (Ubuntu/Debian)

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify
node -v
npm -v
```

---

### 2. Install MySQL

#### Windows

Download và cài đặt MySQL Installer: https://dev.mysql.com/downloads/installer/

Hoặc sử dụng Laragon (All-in-one): https://laragon.org/download/

#### macOS

```bash
# Using Homebrew
brew install mysql@8.0

# Start MySQL
brew services start mysql@8.0

# Secure installation
mysql_secure_installation
```

#### Linux (Ubuntu/Debian)

```bash
# Install MySQL Server
sudo apt-get install mysql-server

# Start MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure installation
sudo mysql_secure_installation
```

---

## Project Installation

### 1. Clone Repository

```bash
# Clone from Git
git clone <repository-url> cgbasv2
cd cgbasv2

# Or download ZIP and extract
```

### 2. Install Dependencies

```bash
npm install
```

**Dependencies installed:**
```json
{
  "axios": "^1.13.2",
  "bcryptjs": "^3.0.3",
  "cors": "^2.8.5",
  "crypto-js": "^4.2.0",
  "dotenv": "^17.2.3",
  "express": "^5.2.1",
  "express-session": "^1.18.2",
  "mysql2": "^3.16.0",
  "node-cron": "^4.2.1",
  "winston": "^3.19.0",
  "winston-daily-rotate-file": "^5.0.0"
}
```

---

### 3. Create Database

```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE cgbas_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

# Exit
EXIT;
```

---

### 4. Configure Environment

Create `.env` file in project root:

```bash
# Copy from example
cp .env.example .env

# Edit với editor
nano .env
# hoặc
code .env
```

**Development `.env`:**
```bash
# ======================
# DATABASE CONFIGURATION
# ======================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=cgbas_db
DB_PORT=3306

# ======================
# SERVER CONFIGURATION
# ======================
PORT=3000
NODE_ENV=development

# Session secret (Development only)
SESSION_SECRET=dev-secret-key-change-me

# ======================
# CGBAS PRO API
# ======================
API_BASE_URL=https://api.cgbas.com
AK=your_access_key_here
SK=your_secret_key_here

# ======================
# EWELINK CLOUD API
# ======================
EWELINK_API=https://eu-apia.coolkit.cc
EWELINK_TOKEN=your_bearer_token_here
```

**⚠️ Important**: Thay thế các giá trị sau:
- `DB_PASSWORD`: MySQL root password
- `AK`, `SK`: CGBAS PRO API keys
- `EWELINK_TOKEN`: eWelink bearer token

---

### 5. Run Database Migrations

```bash
node src/migrations/index.js
```

**Expected Output:**
```
- Thực thi migration: 001_create_stations_table.sql (Thành công)
- Thực thi migration: 002_create_ewelink_tables.sql (Thành công)
- Thực thi migration: 003_control_logic_updates.sql (Thành công)
- Thực thi migration: 004_create_api_logs.sql (Thành công)
- Thực thi migration: 005_create_recovery_history.sql (Thành công)
Migration hoàn tất.
```

---

### 6. Create Admin User

```bash
# Generate bcrypt hash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('admin123', 10));"

# Copy hash và insert vào database
mysql -u root -p cgbas_db

INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '<paste-bcrypt-hash-here>', 'Administrator', 'admin');

EXIT;
```

**Example:**
```sql
INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '$2a$10$abc...xyz', 'Administrator', 'admin');
```

---

## Start Application

### Development Mode

```bash
npm start
```

**hoặc:**
```bash
node src/main.js
```

**Expected Output:**
```
--- ĐỒNG BỘ KHỞI TẠO HỆ THỐNG ---
✅ CGBAS: Đồng bộ thành công.
✅ eWelink: Quét khởi tạo hoàn tất.
-------------------------------------------------------
🚀 HỆ THỐNG PHỤC HỒI TRẠM ĐANG CHẠY: http://localhost:3000
-------------------------------------------------------
```

---

## Verify Installation

### 1. Access Application

Open browser: `http://localhost:3000`

**Default Login:**
- Username: `admin`
- Password: `admin123` (hoặc password bạn đã tạo)

### 2. Check API Health

```bash
# Test authentication endpoint
curl http://localhost:3000/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Expected Response:**
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

### 3. Check Database Connection

```bash
# View stations count
mysql -u root -p cgbas_db -e "SELECT COUNT(*) FROM stations;"
```

### 4. Check Logs

```bash
# View application logs
tail -f src/logs/app-*.log

# View error logs
tail -f src/logs/error-*.log
```

---

## Project Structure

```
cgbasv2/
├── docs/                      # Documentation
│   ├── api/                   # API docs
│   ├── architecture/          # Architecture docs
│   ├── database/              # Database docs
│   └── guides/                # Setup guides
├── public/                    # Frontend files
│   ├── assets/               # Static assets
│   ├── css/                  # Stylesheets
│   ├── js/                   # Client-side JavaScript
│   └── views/                # HTML pages
├── src/                       # Backend source code
│   ├── config/               # Configuration
│   │   └── database.js       # MySQL connection
│   ├── controllers/          # Controllers
│   │   └── authController.js
│   ├── middleware/           # Middleware
│   │   └── auth.js          # Authentication
│   ├── migrations/           # Database migrations
│   ├── repository/           # Data access layer
│   │   ├── stationRepo.js
│   │   └── ewelinkRepo.js
│   ├── routes/               # API routes
│   │   ├── authRoutes.js
│   │   ├── stationRoutes.js
│   │   └── ewelinkRoutes.js
│   ├── services/             # Business logic
│   │   ├── cgbasApi.js
│   │   ├── ewelinkService.js
│   │   └── stationControlService.js
│   ├── utils/                # Utilities
│   │   ├── autoMonitor.js
│   │   ├── crypto.js
│   │   ├── helper.js
│   │   ├── logger.js
│   │   └── scheduler.js
│   ├── logs/                 # Application logs (auto-created)
│   └── main.js              # Application entry point
├── .env                      # Environment variables
├── .env.example             # Environment template
├── .gitignore               # Git ignore rules
├── package.json             # NPM dependencies
└── README.md                # Project overview
```

---

## Development Tools (Optional)

### 1. Install Nodemon (Auto-restart)

```bash
npm install -g nodemon

# Run with nodemon
nodemon src/main.js
```

### 2. Install VS Code Extensions

Recommended extensions:
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **MySQL** - Database management
- **GitLens** - Git integration
- **REST Client** - API testing

### 3. Database GUI Tools

**Windows:**
- HeidiSQL: https://www.heidisql.com/
- MySQL Workbench: https://dev.mysql.com/downloads/workbench/

**macOS:**
- Sequel Pro: https://www.sequelpro.com/
- TablePlus: https://tableplus.com/

**Cross-platform:**
- DBeaver: https://dbeaver.io/
- phpMyAdmin (web-based)

---

## Troubleshooting

### Database Connection Failed

```bash
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solutions:**
1. Check MySQL is running:
   ```bash
   # Windows (via services)
   services.msc → MySQL80

   # Linux/Mac
   sudo systemctl status mysql
   ```

2. Verify credentials in `.env`
3. Check MySQL port (default 3306)

### Port Already in Use

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**
1. Change port in `.env`:
   ```bash
   PORT=3001
   ```

2. Kill process on port 3000:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F

   # Linux/Mac
   lsof -ti:3000 | xargs kill -9
   ```

### Migration Failed

```bash
Error: ER_DUP_FIELDNAME: Duplicate column name
```

**Solutions:**
- Migration đã chạy rồi (safe to ignore)
- Hoặc drop database và tạo lại:
  ```sql
  DROP DATABASE cgbas_db;
  CREATE DATABASE cgbas_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```

### Cannot Find Module

```bash
Error: Cannot find module 'express'
```

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## Next Steps

1. ✅ **Configure External APIs**
   - Setup CGBAS PRO API keys
   - Configure eWelink bearer token
   
2. ✅ **Map Devices**
   - Link stations với eWelink devices
   - Test recovery scenarios

3. ✅ **Customize Settings**
   - Adjust retry intervals
   - Configure monitoring alerts

4. ✅ **Read Documentation**
   - [API Documentation](../api/)
   - [Architecture Overview](../architecture/system-overview.md)
   - [Configuration Guide](./configuration.md)

---

**Related:**
- [Configuration Guide](./configuration.md)
- [Development Guide](./development.md)
- [Deployment Guide](./deployment.md)
