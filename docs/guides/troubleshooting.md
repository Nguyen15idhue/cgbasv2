# 🔍 Troubleshooting Guide

Hướng dẫn xử lý các sự cố thường gặp trong CGBAS v2.

---

## Database Issues

### 1. Connection Refused

**Triệu chứng:**
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Nguyên nhân:**
- MySQL chưa chạy
- Port sai
- Credentials sai

**Giải pháp:**

```bash
# Kiểm tra MySQL đang chạy
# Windows
services.msc → MySQL80 → Start

# Linux/Mac
sudo systemctl status mysql
sudo systemctl start mysql

# Kiểm tra port
netstat -an | grep 3306

# Test connection
mysql -u root -p -h localhost
```

---

### 2. Too Many Connections

**Triệu chứng:**
```
Error: ER_TOO_MANY_USER_CONNECTIONS: Too many connections
```

**Giải pháp:**

```sql
-- Tăng max_connections
SET GLOBAL max_connections = 200;

-- Hoặc edit my.cnf
[mysqld]
max_connections = 200

-- Restart MySQL
sudo systemctl restart mysql
```

---

### 3. Character Set Issues

**Triệu chứng:**
- Tiếng Việt hiển thị ???
- Lỗi collation

**Giải pháp:**

```sql
-- Kiểm tra charset
SHOW VARIABLES LIKE 'character_set%';

-- Convert database
ALTER DATABASE cgbas_db 
CHARACTER SET = utf8mb4 
COLLATE = utf8mb4_unicode_ci;

-- Convert tables
ALTER TABLE stations 
CONVERT TO CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```

---

## Application Issues

### 1. Port Already in Use

**Triệu chứng:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Giải pháp:**

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Hoặc đổi port trong .env
PORT=3001
```

---

### 2. Module Not Found

**Triệu chứng:**
```
Error: Cannot find module 'express'
```

**Giải pháp:**

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Clear npm cache if needed
npm cache clean --force
npm install
```

---

### 3. Session Lost on Refresh

**Triệu chứng:**
- Đăng nhập xong refresh bị logout
- Session không persist

**Nguyên nhân:**
- Cookie settings sai
- Session middleware config sai

**Giải pháp:**

```javascript
// src/main.js - Kiểm tra session config
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,  // Phải false
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false  // Chỉ true với HTTPS
    },
    name: 'cgbas_session'
}));
```

---

### 4. CORS Errors

**Triệu chứng:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Giải pháp:**

```javascript
// src/main.js
const cors = require('cors');

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
```

---

## API Integration Issues

### 1. CGBAS API Signature Failed

**Triệu chứng:**
```
Error: Invalid signature
Code: 401 Unauthorized
```

**Nguyên nhân:**
- AK/SK sai
- Signature algorithm sai
- Timestamp issues

**Giải pháp:**

```bash
# Kiểm tra .env
echo $AK
echo $SK

# Test signature manually
node -e "
const crypto = require('crypto');
const method = 'GET';
const path = '/openapi/stream/stations';
const nonce = 'test123';
const timestamp = Date.now().toString();
const signString = method + '\\n' + path + '\\n' + nonce + '\\n' + timestamp;
const sign = crypto.createHmac('sha256', 'YOUR_SK').update(signString).digest('hex').toUpperCase();
console.log('Signature:', sign);
"
```

---

### 2. eWelink API Token Expired

**Triệu chứng:**
```
Error: Token expired
401 Unauthorized
```

**Giải pháp:**

```bash
# Lấy token mới từ eWelink app hoặc API
curl -X POST https://eu-apia.coolkit.cc/v2/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "countryCode": "+84",
    "phoneNumber": "0123456789",
    "password": "your_password"
  }'

# Cập nhật .env
EWELINK_TOKEN=new_token_here

# Restart application
pm2 restart cgbas-v2
```

---

### 3. Device Offline

**Triệu chứng:**
```
[Job STA001] ⚠️ Thiết bị eWelink Ngoại tuyến
```

**Giải pháp:**

1. **Kiểm tra thiết bị:**
   - Đèn indicator trên SONOFF
   - WiFi connection
   - Power supply

2. **Kiểm tra eWelink app:**
   - Device có online không?
   - Thử điều khiển thủ công

3. **Restart thiết bị:**
   ```bash
   # Restart từ API
   curl -X POST http://localhost:3000/api/ewelink/control \
     -H "Content-Type: application/json" \
     -d '{"deviceid":"1000abc123","channel":"1","action":"off"}' \
     -b cookies.txt
   ```

---

## Recovery Issues

### 1. Job Stuck in RUNNING

**Triệu chứng:**
- Job không chuyển sang CHECKING hoặc SUCCESS
- Stuck ở RUNNING > 5 phút

**Giải pháp:**

```sql
-- Kiểm tra job
SELECT * FROM station_recovery_jobs WHERE status = 'RUNNING';

-- Reset về PENDING
UPDATE station_recovery_jobs 
SET status = 'PENDING', next_run_time = NOW() 
WHERE status = 'RUNNING' AND updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE);

-- Hoặc xóa job
DELETE FROM station_recovery_jobs WHERE station_id = 'STA001';
```

---

### 2. Too Many Retries

**Triệu chứng:**
```
[Job STA001] 🚨 ĐÃ ĐẠT GIỚI HẠN 6 LẦN THỬ
```

**Nguyên nhân:**
- Trạm thực sự có vấn đề phần cứng
- Kết nối eWelink không ổn định
- Kịch bản không phù hợp

**Giải pháp:**

1. **Kiểm tra phần cứng:**
   - Nguồn điện
   - Cáp kết nối
   - Antenna

2. **Test thủ công:**
   ```bash
   # Bật trạm thủ công
   curl -X POST http://localhost:3000/api/ewelink/station-on \
     -H "Content-Type: application/json" \
     -d '{"deviceid":"1000abc123"}' \
     -b cookies.txt
   ```

3. **Xem lịch sử:**
   ```bash
   # Xem failure reason
   curl "http://localhost:3000/api/stations/recovery-history?stationId=STA001&status=FAILED" \
     -b cookies.txt
   ```

---

### 3. Station Not Recovering

**Triệu chứng:**
- Job SUCCESS nhưng trạm vẫn offline
- connectStatus vẫn = 3

**Giải pháp:**

1. **Tăng verification time:**
   ```javascript
   // src/services/stationControlService.js
   await sleep(180000);  // 3 phút thay vì 2
   ```

2. **Kiểm tra CGBAS:**
   - Trạm có thực sự boot?
   - Network connection OK?
   - CGBAS PRO hiển thị gì?

3. **Test scenario:**
   ```bash
   # Test từng bước
   # 1. Bật nguồn
   curl -X POST http://localhost:3000/api/ewelink/control \
     -d '{"deviceid":"1000abc123","channel":"1","action":"on"}'
   
   # 2. Đợi 10s
   
   # 3. Kích nút
   curl -X POST http://localhost:3000/api/ewelink/control \
     -d '{"deviceid":"1000abc123","channel":"2","action":"on"}'
   
   # 4. Đợi 5s
   
   # 5. Nhả nút
   curl -X POST http://localhost:3000/api/ewelink/control \
     -d '{"deviceid":"1000abc123","channel":"2","action":"off"}'
   ```

---

## Performance Issues

### 1. Slow Response Time

**Triệu chứng:**
- API response > 2 giây
- Dashboard load chậm

**Giải pháp:**

```bash
# Kiểm tra MySQL slow queries
mysql -u root -p -e "SHOW PROCESSLIST;"

# Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

# Kiểm tra indexes
SHOW INDEX FROM stations;
SHOW INDEX FROM station_dynamic_info;

# Add missing indexes
CREATE INDEX idx_connect_status ON station_dynamic_info(connectStatus);
```

---

### 2. High Memory Usage

**Triệu chứng:**
- Node.js process > 500MB
- Server slow

**Giải pháp:**

```bash
# Kiểm tra memory
pm2 list
htop

# Restart application
pm2 restart cgbas-v2

# Tăng memory limit
NODE_OPTIONS="--max-old-space-size=2048" npm start

# Clear logs
pm2 flush
find src/logs -name "*.log" -mtime +7 -delete
```

---

### 3. Database Growing Too Large

**Triệu chứng:**
- Database > 5GB
- Slow queries

**Giải pháp:**

```sql
-- Check table sizes
SELECT 
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'cgbas_db'
ORDER BY (data_length + index_length) DESC;

-- Clean old logs
DELETE FROM ewelink_api_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

DELETE FROM station_recovery_history 
WHERE completed_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Optimize tables
OPTIMIZE TABLE ewelink_api_logs;
OPTIMIZE TABLE station_recovery_history;
```

---

## Logging Issues

### 1. Logs Not Created

**Triệu chứng:**
- Folder `src/logs/` trống
- Không thấy log files

**Giải pháp:**

```bash
# Tạo logs directory
mkdir -p src/logs

# Kiểm tra permissions
chmod 755 src/logs

# Kiểm tra winston config
# src/utils/logger.js
```

---

### 2. Log Files Too Large

**Triệu chứng:**
- Log file > 100MB
- Disk full

**Giải pháp:**

```bash
# Rotate logs manually
cd src/logs
gzip app-2026-01-10.log
rm app-2026-01-10.log

# Configure auto-rotation
# src/utils/logger.js
new DailyRotateFile({
    filename: 'src/logs/app-%DATE%.log',
    maxFiles: '14d',  # Keep 14 days
    maxSize: '20m'    # Max 20MB per file
})
```

---

## Scheduler Issues

### 1. Cron Not Running

**Triệu chứng:**
- Stations không sync
- Recovery không tự động chạy

**Giải pháp:**

```bash
# Kiểm tra logs
tail -f src/logs/app-*.log | grep "Đồng bộ"

# Restart application
pm2 restart cgbas-v2

# Test scheduler manually
node -e "
const { initCronJobs } = require('./src/utils/scheduler');
initCronJobs();
console.log('Scheduler started');
"
```

---

### 2. Multiple Schedulers Running

**Triệu chứng:**
- Duplicate job executions
- Logs show double entries

**Giải pháp:**

```bash
# Stop all processes
pm2 stop all

# Delete all PM2 processes
pm2 delete all

# Start single instance
pm2 start src/main.js --name cgbas-v2 -i 1

# Save config
pm2 save
```

---

## Common Error Messages

### `ENOENT: no such file or directory`

**Giải pháp:**
```bash
# Tạo missing directories
mkdir -p src/logs
mkdir -p public/assets
```

### `EADDRINUSE: address already in use`

**Giải pháp:**
```bash
# Kill process on port
lsof -ti:3000 | xargs kill -9
```

### `ER_ACCESS_DENIED_ERROR`

**Giải pháp:**
```sql
-- Reset MySQL password
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
```

### `Cannot read property of undefined`

**Giải pháp:**
- Kiểm tra `.env` có đầy đủ variables
- Kiểm tra API response structure
- Add null checks trong code

---

## Debug Mode

### Enable Verbose Logging

```bash
# .env
LOG_LEVEL=debug
NODE_ENV=development

# Restart
pm2 restart cgbas-v2 --update-env
```

### Debug Specific Module

```javascript
// Thêm console.log
console.log('[DEBUG]', variableName);

// Hoặc dùng debugger
debugger;
```

---

## Getting Help

### 1. Check Logs First

```bash
# Application logs
tail -n 100 src/logs/app-*.log

# Error logs
tail -n 100 src/logs/error-*.log

# PM2 logs
pm2 logs cgbas-v2 --lines 100
```

### 2. Collect System Info

```bash
# Node version
node -v

# NPM version
npm -v

# MySQL version
mysql --version

# OS info
uname -a  # Linux/Mac
systeminfo  # Windows

# PM2 status
pm2 status
```

### 3. Create Issue Report

Include:
- Error message (full stack trace)
- Steps to reproduce
- Environment (OS, Node version)
- Logs (relevant parts)
- .env settings (redact secrets)

---

**Related:**
- [Installation Guide](./installation.md)
- [Configuration Guide](./configuration.md)
- [Deployment Guide](./deployment.md)
