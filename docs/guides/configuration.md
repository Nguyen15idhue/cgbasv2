# ⚙️ Configuration Guide

Hướng dẫn cấu hình hệ thống CGBAS v2.

---

## Environment Variables

Tạo file `.env` trong thư mục root:

```bash
# ======================
# DATABASE CONFIGURATION
# ======================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cgbas_db
DB_PORT=3306

# ======================
# SERVER CONFIGURATION
# ======================
PORT=3000
NODE_ENV=development

# Session secret (Change in production!)
SESSION_SECRET=your-secret-key-change-in-production-minimum-32-characters

# ======================
# CGBAS PRO API
# ======================
API_BASE_URL=https://api.cgbas.com
AK=your_access_key
SK=your_secret_key

# ======================
# EWELINK CLOUD API
# ======================
EWELINK_API=https://eu-apia.coolkit.cc
EWELINK_TOKEN=your_bearer_token_here
```

---

## Configuration Details

### 1. Database Configuration

#### Development

```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=cgbas_db
DB_PORT=3306
```

#### Production

```bash
DB_HOST=10.0.0.5
DB_USER=cgbas_user
DB_PASSWORD=strong_password_here
DB_NAME=cgbas_production
DB_PORT=3306

# Connection pooling
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000
```

**Best Practices:**
- Sử dụng user riêng với quyền hạn chế
- Enable SSL cho connection
- Sử dụng connection pooling

---

### 2. Server Configuration

#### Development

```bash
PORT=3000
NODE_ENV=development
```

#### Production

```bash
PORT=3000
NODE_ENV=production

# Bind to specific interface
HOST=0.0.0.0

# Process management (PM2)
PM2_INSTANCES=4
PM2_EXEC_MODE=cluster
```

---

### 3. Session Management

#### Development

```bash
SESSION_SECRET=dev-secret-key-12345
```

#### Production

**⚠️ CRITICAL**: Session secret phải:
- Tối thiểu 32 ký tự
- Random và unique
- Không bao giờ commit vào git

```bash
# Generate secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

SESSION_SECRET=a7f8c9d2e4b6a1c3e5f7d9b2c4e6a8f1b3d5e7f9a1c3e5f7d9b2c4e6a8f1b3d5
```

**Session Settings:**
```javascript
{
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,  // 24 giờ
    httpOnly: true,
    secure: NODE_ENV === 'production',  // HTTPS only
    sameSite: 'strict'
  }
}
```

---

### 4. CGBAS PRO API

#### Lấy API Keys

1. Đăng nhập [CGBAS PRO](https://www.cgbas.com)
2. Vào **Settings → API Management**
3. Tạo Access Key & Secret Key

#### Configuration

```bash
API_BASE_URL=https://api.cgbas.com
AK=your_16_character_key
SK=your_32_character_secret
```

#### Signature Algorithm

Hệ thống tự động generate HMAC-SHA256 signature:

```javascript
const sign = crypto
  .createHmac('sha256', secretKey)
  .update(signString)
  .digest('hex')
  .toUpperCase();
```

**Sign String Format:**
```
{method}\n{path}\n{X-Nonce}\n{X-Timestamp}
```

---

### 5. eWelink Cloud API

#### Lấy Bearer Token

**Option 1: eWelink App**
1. Đăng nhập eWelink mobile app
2. Settings → About → Copy Token

**Option 2: API Login**
```bash
curl -X POST https://eu-apia.coolkit.cc/v2/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "countryCode": "+84",
    "phoneNumber": "0123456789",
    "password": "your_password"
  }'
```

#### Configuration

```bash
# Region-specific endpoints
# Europe
EWELINK_API=https://eu-apia.coolkit.cc

# Asia
# EWELINK_API=https://as-apia.coolkit.cc

# Americas
# EWELINK_API=https://us-apia.coolkit.cc

EWELINK_TOKEN=your_jwt_bearer_token_here
```

**Token Format:**
```
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Database Setup

### 1. Create Database

```sql
CREATE DATABASE cgbas_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 2. Create User (Production)

```sql
CREATE USER 'cgbas_user'@'%' IDENTIFIED BY 'strong_password';

GRANT SELECT, INSERT, UPDATE, DELETE 
  ON cgbas_db.* 
  TO 'cgbas_user'@'%';

FLUSH PRIVILEGES;
```

### 3. Run Migrations

```bash
node src/migrations/index.js
```

**Expected Output:**
```
Migration thực thi: 001_create_stations_table.sql
Migration thực thi: 002_create_ewelink_tables.sql
Migration thực thi: 003_control_logic_updates.sql
Migration thực thi: 004_create_api_logs.sql
Migration thực thi: 005_create_recovery_history.sql
Migration hoàn tất.
```

---

## Application Settings

### Logging Configuration

**Location**: `src/utils/logger.js`

```javascript
// Log levels
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',  // debug, info, warn, error
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Application logs (daily rotate)
    new DailyRotateFile({
      filename: 'src/logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',  // Keep 30 days
      maxSize: '20m'    // Max 20MB per file
    }),
    // Error logs
    new DailyRotateFile({
      filename: 'src/logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '90d'   // Keep 90 days
    })
  ]
});
```

**Production Settings:**
```bash
LOG_LEVEL=warn
LOG_MAX_FILES=30d
LOG_MAX_SIZE=50m
```

---

### Scheduler Configuration

**Location**: `src/utils/scheduler.js`

```javascript
// Sync interval (default: 15 seconds)
const SYNC_INTERVAL = process.env.SYNC_INTERVAL || '*/15 * * * * *';

cron.schedule(SYNC_INTERVAL, async () => {
  // Đồng bộ CGBAS
  // Kiểm tra phục hồi
});
```

**Custom Intervals:**
```bash
# Every 30 seconds
SYNC_INTERVAL=*/30 * * * * *

# Every minute
SYNC_INTERVAL=* * * * *

# Every 5 minutes
SYNC_INTERVAL=*/5 * * * *
```

---

### Recovery Configuration

**Location**: `src/services/stationControlService.js`

```javascript
// Retry intervals (minutes)
const RETRY_INTERVALS = [2, 5, 10, 15, 30, 60];

// Max retries before FAILED
const MAX_RETRIES = 6;

// Verification wait time (milliseconds)
const VERIFY_WAIT = 120000;  // 2 minutes
```

**Custom Settings:**
```javascript
// Faster retries (testing)
const RETRY_INTERVALS = [1, 2, 3, 5, 10, 15];

// Longer verification
const VERIFY_WAIT = 180000;  // 3 minutes
```

---

## Security Configuration

### 1. Firewall Rules

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (change default port)
sudo ufw allow 2222/tcp

# Deny direct access to MySQL
sudo ufw deny 3306/tcp

# Enable firewall
sudo ufw enable
```

### 2. Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name cgbas.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cgbas.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/cgbas.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cgbas.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files cache
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        proxy_pass http://localhost:3000;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d cgbas.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## Performance Tuning

### Node.js Settings

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=2048"

# Production optimizations
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
```

### MySQL Tuning

```ini
# /etc/mysql/my.cnf

[mysqld]
# InnoDB settings
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT

# Connection settings
max_connections = 200
max_allowed_packet = 64M

# Query cache (MySQL 5.7)
query_cache_type = 1
query_cache_size = 128M

# Character set
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

---

## Monitoring Configuration

### PM2 Ecosystem File

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'cgbas-v2',
    script: 'src/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    autorestart: true,
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'src/logs']
  }]
};
```

**Start with PM2:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Environment Templates

### `.env.development`

```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=cgbas_dev
PORT=3000
NODE_ENV=development
SESSION_SECRET=dev-secret-key
LOG_LEVEL=debug
```

### `.env.production`

```bash
DB_HOST=production-db-host
DB_USER=cgbas_user
DB_PASSWORD=<secure-password>
DB_NAME=cgbas_production
PORT=3000
NODE_ENV=production
SESSION_SECRET=<generate-secure-key>
LOG_LEVEL=warn
```

---

**Related:**
- [Installation Guide](./installation.md)
- [Deployment Guide](./deployment.md)
- [Troubleshooting](./troubleshooting.md)
