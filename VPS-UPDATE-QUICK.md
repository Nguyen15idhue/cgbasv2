# ⚡ QUICK UPDATE VPS - Cheat Sheet

## 🚀 Cách 1: Dùng Script (Khuyến nghị)

```bash
cd /opt/cgbasv2
chmod +x update-vps.sh
./update-vps.sh
```

**Xong!** Script tự động:
- Pull code mới
- Backup database
- Rebuild container
- Restart service

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
docker-compose build --no-cache app-prod

# Start lại
docker-compose --profile prod up -d

# Xem logs
docker logs -f cgbas-app-prod
```

---

## ✅ Kiểm tra sau khi update

```bash
# 1. Check containers đang chạy
docker ps | grep cgbas

# 2. Check logs có lỗi không
docker logs --tail=50 cgbas-app-prod

# 3. Test web
curl http://localhost:3001/health

# 4. Kiểm tra code đã update chưa
docker exec cgbas-app-prod cat /app/src/services/stationControlService.js | grep -A2 "RETRY_INTERVALS"
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

# Start app
docker start cgbas-app-prod
```

### Lỗi: Port conflict

```bash
# Xem ai đang dùng port
docker ps | grep 3001

# Stop container cũ (nếu có)
docker stop cgbas-app-prod

# Start lại
docker-compose --profile prod up -d
```

### Container không start

```bash
# Xem lỗi
docker logs cgbas-app-prod

# Rebuild lại từ đầu
docker-compose --profile prod down
docker-compose build --no-cache app-prod
docker-compose --profile prod up -d
```

---

## 📋 Backup trước khi update (Optional)

```bash
# Backup database
docker exec cgbas-mysql mysqldump --no-tablespaces -u cgbas -pYOUR_PASSWORD cgbas_db > backup_$(date +%Y%m%d).sql

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
docker-compose build --no-cache app-prod
docker-compose --profile prod up -d
```

---

## 💡 Tips

- ✅ **Nên dùng:** Script `update-vps.sh` (an toàn, tự động backup)
- ⚠️ **Cẩn thận:** `docker-compose down -v` (XÓA DATA!)
- 📊 **Theo dõi:** `docker logs -f cgbas-app-prod` sau khi update
- 🕐 **Thời gian:** Update thường mất 2-5 phút

---

**Lưu ý:** Thay `YOUR_PASSWORD` bằng mật khẩu MySQL thực tế trong file `.env`
