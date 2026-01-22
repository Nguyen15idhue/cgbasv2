# 🚀 HƯỚNG DẪN DEPLOY PRODUCTION ZERO DOWNTIME

## 📋 Tổng quan

Tài liệu này hướng dẫn deploy cập nhật code lên production với **ZERO DOWNTIME** (không gián đoạn dịch vụ).

---

## 🎯 Chiến lược: Rolling Update

Sử dụng 2 container app chạy song song, rebuild và restart từng container một để đảm bảo luôn có ít nhất 1 container đang chạy.

---

## 📝 CÁC BƯỚC THỰC HIỆN

### **BƯỚC 1: SSH vào VPS Production**

```bash
ssh root@YOUR_VPS_IP
cd /root/cgbasv2  # Hoặc đường dẫn project của bạn
```

---

### **BƯỚC 2: Pull code mới từ Git**

```bash
# Backup code hiện tại (optional)
cp -r /root/cgbasv2 /root/cgbasv2_backup_$(date +%Y%m%d_%H%M%S)

# Pull code mới
git pull origin main

# Verify changes
git log -1 --oneline
```

**Output mong đợi:**
```
8352c59 feat: Thêm cơ chế tracking 30 giây cho offline detection
```

---

### **BƯỚC 3: Deploy với Zero Downtime**

#### **Option 1: Rolling Update với scale (Khuyến nghị)**

```bash
# 1. Scale lên 2 instances (nếu chưa có)
docker-compose up -d --scale app-dev=2

# Chờ 5 giây để instance mới sẵn sàng
sleep 5

# 2. Rebuild và restart từng instance
docker-compose build --no-cache app-dev
docker-compose up -d --no-deps --force-recreate app-dev

# 3. Verify service vẫn chạy
docker-compose ps
curl http://localhost:3001/health
```

---

#### **Option 2: Blue-Green Deployment (Nâng cao)**

```bash
# 1. Build image mới với tag khác
docker-compose build --no-cache app-dev
docker tag cgbasv2-app-dev:latest cgbasv2-app-dev:new

# 2. Tạo container mới từ image mới (không stop cũ)
docker run -d \
  --name cgbas-app-new \
  --network cgbasv2_cgbas-network \
  -p 3002:3001 \
  -e DB_HOST=mysql \
  -e DB_USER=cgbas \
  -e DB_PASS=cgbaspassword \
  -e DB_NAME=cgbas_db \
  --env-file .env \
  cgbasv2-app-dev:new

# 3. Test container mới
curl http://localhost:3002/health

# 4. Switch traffic (nếu dùng nginx/load balancer)
# Hoặc stop container cũ và rename
docker stop cgbas-app-dev
docker rm cgbas-app-dev
docker rename cgbas-app-new cgbas-app-dev

# 5. Update docker-compose
docker-compose up -d app-dev
```

---

#### **Option 3: Simple Rebuild (Có downtime ~5-10s)**

```bash
# Rebuild và restart
docker-compose build --no-cache app-dev
docker-compose up -d app-dev

# Verify
docker-compose logs -f app-dev
```

**Downtime:** ~5-10 giây trong quá trình restart

---

### **BƯỚC 4: Verify Migration và Service**

```bash
# 1. Kiểm tra logs migration
docker-compose logs app-dev | grep -i migration

# Mong đợi thấy:
# - Migration 006_add_offline_tracking.sql (Thành công)
# Migration hoàn tất.

# 2. Kiểm tra database
docker exec -it cgbas-mysql mysql -u cgbas -p cgbas_db

# Trong MySQL:
DESCRIBE station_dynamic_info;
# Phải thấy 2 cột mới:
# - first_offline_at
# - offline_duration_seconds

# Kiểm tra data
SELECT stationId, connectStatus, first_offline_at, offline_duration_seconds 
FROM station_dynamic_info 
LIMIT 10;

exit;

# 3. Kiểm tra service health
curl http://localhost:3001/health

# 4. Kiểm tra logs real-time
docker-compose logs -f app-dev

# Phải thấy:
# [09:54:50] 📡 Đồng bộ vệ tinh & Kiểm tra phục hồi...
# (Mỗi 5 giây)
```

---

### **BƯỚC 5: Monitoring sau Deploy**

```bash
# Monitor logs 5 phút đầu
docker-compose logs -f app-dev --tail 100

# Kiểm tra tracking có hoạt động không
docker exec -it cgbas-mysql mysql -u cgbas -p cgbas_db -e \
"SELECT stationId, connectStatus, first_offline_at, offline_duration_seconds 
FROM station_dynamic_info 
WHERE connectStatus != 1 
ORDER BY offline_duration_seconds DESC 
LIMIT 10;"
```

**Kỳ vọng:**
- Trạm offline sẽ có `offline_duration_seconds` tăng dần (mỗi 5s)
- Trạm offline >= 30s sẽ tạo Job trong `station_recovery_jobs`
- Trạm online sẽ có `first_offline_at = NULL`

---

## 🔄 ROLLBACK (Nếu có vấn đề)

### **Rollback Code:**

```bash
# 1. Quay về commit trước
cd /root/cgbasv2
git log --oneline -5  # Xem 5 commit gần nhất
git reset --hard <PREVIOUS_COMMIT_HASH>

# 2. Rebuild
docker-compose build --no-cache app-dev
docker-compose up -d app-dev
```

### **Rollback Database:**

```bash
# Vào MySQL
docker exec -it cgbas-mysql mysql -u cgbas -p cgbas_db

# Xóa 2 cột mới
ALTER TABLE station_dynamic_info 
DROP COLUMN first_offline_at,
DROP COLUMN offline_duration_seconds,
DROP INDEX idx_offline_duration;

# Xóa migration record
DELETE FROM migrations WHERE filename = '006_add_offline_tracking.sql';

exit;
```

---

## 📊 CHECKLIST SAU DEPLOY

- [ ] Migration 006 chạy thành công
- [ ] 2 cột mới xuất hiện trong `station_dynamic_info`
- [ ] Scheduler chạy mỗi 5 giây
- [ ] Tracking hoạt động (offline_duration_seconds tăng)
- [ ] Không tạo Job cho trạm offline < 30s
- [ ] Job cũ vẫn hoạt động bình thường
- [ ] Logs không có error bất thường
- [ ] API `/health` trả về status 200
- [ ] Frontend dashboard vẫn load bình thường

---

## 🚨 TROUBLESHOOTING

### **Lỗi: Migration failed**

```bash
# Xem lỗi chi tiết
docker-compose logs app-dev | grep -i error

# Nếu cột đã tồn tại:
docker exec -it cgbas-mysql mysql -u cgbas -p cgbas_db -e \
"ALTER TABLE station_dynamic_info DROP COLUMN first_offline_at, DROP COLUMN offline_duration_seconds;"

# Xóa migration record để chạy lại
docker exec -it cgbas-mysql mysql -u cgbas -p cgbas_db -e \
"DELETE FROM migrations WHERE filename = '006_add_offline_tracking.sql';"

# Restart container
docker-compose restart app-dev
```

### **Lỗi: Container không start**

```bash
# Xem logs chi tiết
docker-compose logs app-dev --tail 100

# Kiểm tra MySQL có sẵn sàng không
docker exec -it cgbas-mysql mysqladmin ping -h localhost

# Restart MySQL nếu cần
docker-compose restart mysql
sleep 10
docker-compose restart app-dev
```

### **Lỗi: Tracking không hoạt động**

```bash
# Kiểm tra autoMonitor.js có được deploy không
docker exec cgbas-app-dev cat /app/src/utils/autoMonitor.js | grep -i "OFFLINE_THRESHOLD"

# Phải thấy:
# const OFFLINE_THRESHOLD = 30;
# const LOST_DATA_THRESHOLD = 300;
```

---

## 🎯 BEST PRACTICES

1. **Luôn backup trước khi deploy:**
   ```bash
   # Backup database
   docker exec cgbas-mysql mysqldump -u cgbas -p cgbas_db > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # Backup code
   cp -r /root/cgbasv2 /root/cgbasv2_backup_$(date +%Y%m%d_%H%M%S)
   ```

2. **Test local trước:**
   ```bash
   # Test trên local trước khi deploy production
   docker-compose -f docker-compose.yml up --build
   ```

3. **Deploy ngoài giờ cao điểm:**
   - Tốt nhất: 2-4 AM (ít trạm hoạt động)
   - Tránh: 8-11 AM, 1-5 PM (cao điểm)

4. **Monitor 30 phút đầu:**
   - Theo dõi logs liên tục
   - Kiểm tra Jobs có tạo đúng không
   - Đảm bảo không có error bất thường

---

## 📞 LIÊN HỆ HỖ TRỢ

Nếu gặp vấn đề trong quá trình deploy:
1. Chụp logs: `docker-compose logs app-dev > error_logs.txt`
2. Kiểm tra database: `SELECT * FROM migrations;`
3. Liên hệ dev team với thông tin chi tiết

---

**Chúc deploy thành công! 🚀**
