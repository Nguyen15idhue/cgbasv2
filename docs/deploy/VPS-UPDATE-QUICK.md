# ⚡ QUICK UPDATE VPS - Cheat Sheet

## 🚀 Cách 1: Dùng Script (Khuyến nghị)

```bash
cd /opt/cgbasv2
chmod +x update-vps.sh
sudo ./update-vps.sh
```

**Xong!** Script tự động:
- Pull code mới
- Backup database
- Rebuild cả 2 services (app + ntrip)
- Restart services

---

## 🔧 Cách 2: Thủ công (Khi script lỗi)

### A. Pull code mới

```bash
cd /opt/cgbasv2

# Nếu có conflict git
git reset --hard origin/main

# Pull code mới
git pull origin main
```

### B. Rebuild và restart

```bash
# Stop containers
docker-compose --profile prod down

# Rebuild (không dùng cache)
docker-compose build --no-cache app-prod ntrip-prod

# Start lại
docker-compose --profile prod up -d

# Xem logs
docker logs -f cgbas-app-prod
docker logs -f cgbas-ntrip-prod
```

---

## ✅ Kiểm tra sau khi update

```bash
# 1. Check containers đang chạy
docker ps | grep cgbas

# 2. Check logs có lỗi không
docker logs --tail=50 cgbas-app-prod
docker logs --tail=50 cgbas-ntrip-prod

# 3. Test App
curl http://localhost:3001/health

# 4. Test NTRIP
curl http://localhost:3101/health

# 5. Kiểm tra NTRIP connections
curl http://localhost:3101/status
```

---

## 📦 Database Migrations

Migrations chạy tự động khi MySQL container khởi động lần đầu. Nếu có migration mới:

```bash
# Xem migration files mới
ls -la src/migrations/*.sql

# Chạy migration thủ công (nếu cần)
docker exec cgbas-mysql mysql -u root -p cgbas_db < src/migrations/016_add_gga_frequency.sql
```

---

## 🆘 Fix lỗi thường gặp

### Lỗi: Git conflict

```bash
git reset --hard origin/main
git pull origin main
```

### Lỗi: Permission denied (update-vps.sh)

```bash
chmod +x update-vps.sh
./update-vps.sh
```

### Lỗi: MySQL unhealthy

```bash
# Restart MySQL
docker restart cgbas-mysql

# Đợi 15 giây
sleep 15

# Start app + ntrip
docker start cgbas-app-prod cgbas-ntrip-prod
```

### Lỗi: Port conflict

```bash
# Xem ai đang dùng port
docker ps | grep 3001
docker ps | grep 8080

# Stop container cũ (nếu có)
docker stop cgbas-app-prod cgbas-ntrip-prod

# Start lại
docker-compose --profile prod up -d
```

### Container không start

```bash
# Xem lỗi
docker logs cgbas-app-prod
docker logs cgbas-ntrip-prod

# Rebuild lại từ đầu
docker-compose --profile prod down
docker-compose build --no-cache app-prod ntrip-prod
docker-compose --profile prod up -d
```

### NTRIP service không kết nối DB

```bash
# Kiểm tra MySQL đang chạy
docker ps | grep cgbas-mysql

# Kiểm tra DB có bảng ntrip_config chưa
docker exec cgbas-mysql mysql -u root -p cgbas_db -e "SHOW TABLES LIKE 'ntrip%';"

# Kiểm tra config trong DB
docker exec cgbas-mysql mysql -u root -p cgbas_db -e "SELECT * FROM ntrip_config;"
```

---

## 📋 Backup trước khi update (Optional)

```bash
# Backup database
docker exec cgbas-mysql mysqldump --no-tablespaces -u root -p cgbas_db > backup_$(date +%Y%m%d).sql

# Backup code
cp -r /opt/cgbasv2 /opt/cgbasv2_backup_$(date +%Y%m%d)
```

---

## 🔄 Rollback về code cũ

```bash
cd /opt/cgbasv2

# Xem các commit gần đây
git log --oneline -5

# Quay về commit trước
git reset --hard COMMIT_HASH

# Rebuild
docker-compose build --no-cache app-prod ntrip-prod
docker-compose --profile prod up -d
```

---

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────┐
│                  CGBAS VPS                       │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │  cgbas-app   │  │ cgbas-ntrip  │             │
│  │  (Node.js)   │  │   (Go)       │             │
│  │  Port 3001   │  │  Port 3101   │             │
│  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                     │
│         └────────┬─────────┘                     │
│                  │                               │
│         ┌────────▼────────┐                     │
│         │  cgbas-mysql    │                     │
│         │  Port 3306      │                     │
│         └─────────────────┘                     │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 💡 Tips

- ✅ **Nên dùng:** Script `update-vps.sh` (an toàn, tự động backup)
- ⚠️ **Cẩn thận:** `docker-compose down -v` (XÓA DATA!)
- 📊 **Theo dõi:** `docker logs -f cgbas-app-prod` sau khi update
- 🕐 **Thời gian:** Update thường mất 2-5 phút
- 🔄 **NTRIP:** Service tự reconnect khi mất kết nối caster

---

**Lưu ý:** Thay `YOUR_PASSWORD` bằng mật khẩu MySQL thực tế trong file `.env`
