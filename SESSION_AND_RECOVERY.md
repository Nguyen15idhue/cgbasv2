# 🔄 Session & Auto-Recovery 24/7 Mechanism

## 📋 Overview

Hệ thống CGBAS có 2 phần hoạt động độc lập:

1. **Session** - Cho web UI & API authentication (24h timeout)
2. **Auto-Recovery Scheduler** - Chạy 24/7 độc lập từ session (background service)

---

## 🔐 Session Configuration

### Current Settings

```javascript
// File: src/main.js
cookie: {
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    httpOnly: true,                // Bảo mật (JS không truy cập)
    secure: process.env.NODE_ENV === 'production'  // HTTPS only in prod
}
```

### Timeout Duration

- **Login duration**: 24 hours từ lần đăng nhập
- **After timeout**: Redirect tới login page
- **Session storage**: Express session (memory hoặc Redis)

### Extend Session

Session tự động extend khi:
- User có hoạt động trên website
- Mỗi request gửi đi, session timer reset

---

## 🚀 Auto-Recovery 24/7 (Background Service)

### How It Works

```
Server Start
    ↓
Load Database
    ↓
Start Scheduler (15s interval)
    ↓
Every 15 seconds:
  - Check failed stations
  - Check pending recovery jobs
  - Execute recovery (bất đồ bộ)
    ↓
Continue 24/7 (không cần user đăng nhập)
```

### Key Points

1. **Độc lập với session** - Chạy ngay cả khi không ai đăng nhập
2. **Không cần web UI** - Chạy backend background
3. **Persistent** - Restart server thì tự động chạy lại

### Implementation

**Scheduler (chạy every 15s):**
```javascript
// File: src/utils/scheduler.js
cron.schedule('*/15 * * * * *', async () => {
    await checkAndTriggerRecovery();
});
```

**Recovery checker:**
```javascript
// File: src/utils/autoMonitor.js
async function checkAndTriggerRecovery() {
    // 1. Check failed stations
    // 2. Create recovery job
    // 3. Execute recovery
}
```

---

## 📊 Practical Scenarios

### Scenario 1: VPS Production (User không online)

```
Day 1, 10:00 AM - User đăng nhập → Session tạo
Day 1, 10:00 PM - Session expires (24h sau)
Day 2, 8:00 AM - User offline, nhưng recovery vẫn chạy 24/7
                ✅ Nếu trạm lỗi lúc 3:00 AM, recovery tự động triggered
```

### Scenario 2: VPS Production (Multiple users)

```
User A đăng nhập → Session A (24h)
User B đăng nhập → Session B (24h)
User A logout   → Session A expires
User B timeout  → Session B expires
                → Recovery scheduler vẫn chạy, không cần session nào
```

### Scenario 3: Server Restart

```
Server crash/restart
    ↓
Database migrations run
    ↓
Users table created
    ↓
Scheduler auto-start
    ↓
Recovery chạy 24/7 ngay lập tức (không cần chờ ai login)
```

---

## 🔧 Configuration

### Change Session Timeout

**Edit `src/main.js`:**

```javascript
cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    // ...
}
```

### Change Recovery Check Interval

**Edit `src/utils/scheduler.js`:**

```javascript
// Check every 30 seconds (default: 15 seconds)
cron.schedule('*/30 * * * * *', async () => {
    await checkAndTriggerRecovery();
});

// Check every 10 seconds (more frequent)
cron.schedule('*/10 * * * * *', async () => {
    await checkAndTriggerRecovery();
});
```

---

## ✅ Verification Checklist (Local)

### 1. Verify session setting
```bash
# Check default credentials
Username: admin
Password: admin123
```

### 2. Check scheduler is running
```bash
# Terminal output should show:
🚀 Scheduler: 15s (Satellite & Recovery Monitor) | 1h (Station List).
```

### 3. Verify recovery jobs
```bash
# Access MySQL
mysql -u root cgbas_db

# Check recovery jobs
SELECT * FROM station_recovery_jobs;

# Check history
SELECT * FROM station_recovery_history;
```

### 4. Simulate station failure
```bash
# Manually update station status to simulate failure
UPDATE station_dynamic_info 
SET connectStatus = 0 
WHERE stationId = 'SOME_STATION_ID';

# Wait 15-30 seconds and check
SELECT * FROM station_recovery_jobs WHERE station_id = 'SOME_STATION_ID';
```

---

## ✅ Verification Checklist (VPS Production)

### 1. Check scheduler running after restart

```bash
# SSH vào VPS
ssh user@your-vps

# View logs
cd /opt/cgbasv2
docker-compose logs -f app-prod

# Should see:
# 🚀 Scheduler: 15s (Satellite & Recovery Monitor) | 1h (Station List).
```

### 2. Verify recovery job created

```bash
# Check database
docker exec cgbas-mysql mysql -u cgbas -p cgbas_db -e "SELECT * FROM station_recovery_jobs LIMIT 5;"
```

### 3. Test scheduler without login

```bash
# Manually create failed station
docker exec cgbas-mysql mysql -u cgbas -p cgbas_db -e "UPDATE station_dynamic_info SET connectStatus = 0 WHERE stationId = 'TEST_STATION';"

# Wait 15-30 seconds
# Check if recovery job created automatically
docker exec cgbas-mysql mysql -u cgbas -p cgbas_db -e "SELECT * FROM station_recovery_jobs WHERE station_id = 'TEST_STATION';"
```

---

## 🎯 Best Practices

### 1. Session Security

```javascript
// ✅ Good (Production)
cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,          // Prevent XSS
    secure: true,            // HTTPS only
    sameSite: 'strict'       // CSRF protection
}

// ❌ Bad
cookie: {
    maxAge: null,            // Never expires
    httpOnly: false,         // Vulnerable to XSS
    secure: false            // HTTP unsecure
}
```

### 2. Recovery Monitoring

```bash
# Monitor recovery in real-time
docker-compose logs -f app-prod | grep -i "recovery"

# Count recovery jobs
docker exec cgbas-mysql mysql -u cgbas -p cgbas_db -e "SELECT status, COUNT(*) FROM station_recovery_jobs GROUP BY status;"
```

### 3. Scheduler Performance

- **Current interval**: 15 seconds (good balance)
- **If many stations**: Reduce to 30-60 seconds
- **If few stations**: Keep at 15 seconds
- **Max**: Don't go below 10 seconds (DB load)

---

## 🚨 Troubleshooting

### Issue: Recovery not working on VPS

```bash
# Check scheduler logs
docker-compose logs app-prod | grep -i scheduler

# Check if container is running
docker ps | grep app-prod

# Restart
docker-compose restart app-prod

# Check logs again
docker-compose logs -f app-prod
```

### Issue: Too many recovery jobs

```bash
# Check pending jobs
SELECT COUNT(*) FROM station_recovery_jobs WHERE status = 'PENDING';

# Clear old jobs (before cleaning, backup!)
DELETE FROM station_recovery_jobs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### Issue: Session keeps expiring on VPS

```bash
# Increase timeout to 7 days
# Edit docker-compose.yml and rebuild:
docker-compose build --no-cache
docker-compose --profile prod down
docker-compose --profile prod up -d
```

---

## 📝 Summary

| Feature | Duration | Requirement | Scope |
|---------|----------|-------------|-------|
| **Web Session** | 24 hours | Login required | UI/API authentication |
| **Auto-Recovery** | 24/7 | Server running | Background service |
| **Database Persistence** | Permanent | Storage | Data saved |

### Key Takeaway

✅ **Phục hồi chạy 24/7 độc lập với session user**

- User logout → Session mất
- Server restart → Recovery tự động chạy lại
- Nobody login → Recovery vẫn hoạt động

🎯 **Production Setup (Recommended)**
- Session timeout: 24 hours (user logout auto)
- Recovery check: Every 15 seconds (24/7)
- Database: Persistent volume
- Auto restart: enabled

---

## 🔗 Related Files

- [src/main.js](../src/main.js) - Session configuration
- [src/utils/scheduler.js](../src/utils/scheduler.js) - Auto-recovery scheduler
- [src/utils/autoMonitor.js](../src/utils/autoMonitor.js) - Recovery trigger logic
- [src/services/stationControlService.js](../src/services/stationControlService.js) - Recovery execution
