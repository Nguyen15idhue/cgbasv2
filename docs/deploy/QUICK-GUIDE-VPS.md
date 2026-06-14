# 🚀 Quick Guide VPS - Các bước thường dùng

## 📌 Khởi động Production lần đầu

```bash
cd /opt/cgbasv2
docker-compose --profile prod up -d --build
docker ps -a | grep cgbas
```

---

## 🔄 Update code mới từ Git

```bash
cd /opt/cgbasv2

# Backup database trước khi update
docker exec cgbas-mysql mysqldump -u root -p cgbas_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Pull code mới
git pull origin main

# Rebuild và restart
docker-compose --profile prod down
docker-compose --profile prod up -d --build

# Xem logs để kiểm tra
docker-compose logs -f --tail=100 app-prod
```

---

## 📊 Kiểm tra hệ thống

```bash
# Xem trạng thái containers
docker ps -a | grep cgbas

# Xem logs production
docker-compose logs -f --tail=100 app-prod

# Xem logs MySQL
docker-compose logs -f --tail=50 mysql

# Kiểm tra resource usage
docker stats

# Test health endpoint
curl http://localhost:3001/health
```

---

## 💾 Backup Database

```bash
# Backup thủ công
cd /opt/cgbasv2
docker exec cgbas-mysql mysqldump -u root -p cgbas_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup với gzip (nén)
docker exec cgbas-mysql mysqldump -u root -p cgbas_db | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore từ backup
docker exec -i cgbas-mysql mysql -u root -p cgbas_db < backup_20260120.sql
```

---

## 🔧 Restart Services

```bash
# Restart app production
docker restart cgbas-app-prod

# Restart MySQL
docker restart cgbas-mysql

# Restart tất cả
docker-compose restart
```

---

## 🐛 Debug khi có lỗi

```bash
# Xem logs chi tiết
docker logs --tail=500 cgbas-app-prod

# Xem logs có lỗi
docker-compose logs app-prod | grep -i error

# Vào shell container để debug
docker exec -it cgbas-app-prod sh

# Check health status
docker inspect cgbas-app-prod | grep -A 20 Health

# Xem container details
docker inspect cgbas-app-prod
```

---

## 🧹 Cleanup (khi cần)

```bash
# Xóa app-dev nếu có (VPS chỉ cần prod)
docker rm -f cgbas-app-dev
docker rmi cgbasv2-app-dev

# Xóa dangling images (an toàn)
docker image prune

# ⚠️ KHÔNG dùng lệnh này (xóa base images)
# docker image prune -a

# Nếu đã xóa nhầm base images, pull lại:
docker pull mysql:8.0-debian
docker pull node:18-alpine
```

---

## ⚠️ QUAN TRỌNG - Không làm những điều này

```bash
# ❌ KHÔNG xóa MySQL container (mất data)
docker rm -f cgbas-mysql

# ❌ KHÔNG xóa volumes (mất database)
docker-compose down -v
docker volume rm cgbasv2_mysql-data

# ❌ KHÔNG dùng prune -a (xóa base images cần thiết)
docker image prune -a

# ❌ KHÔNG restart MySQL khi không cần thiết
docker restart cgbas-mysql
```

---

## 📞 Cheat Sheet - Lệnh hay dùng nhất

```bash
# Xem status
docker ps | grep cgbas

# Xem logs real-time
docker-compose logs -f app-prod

# Restart app
docker restart cgbas-app-prod

# Backup DB
docker exec cgbas-mysql mysqldump -u root -p cgbas_db > backup.sql

# Update code
git pull && docker-compose --profile prod up -d --build

# Test health
curl http://localhost:3001/health
```

---

## 🎯 Khi nào cần rebuild hoàn toàn

```bash
# Khi thay đổi dependencies (package.json)
docker-compose --profile prod down
docker-compose --profile prod build --no-cache
docker-compose --profile prod up -d

# Khi thay đổi Dockerfile
docker-compose --profile prod build --no-cache
docker-compose --profile prod up -d
```

---

## 📝 Cron Job - Backup tự động

Thêm vào crontab (`crontab -e`):

```bash
# Backup database mỗi ngày lúc 2h sáng
0 2 * * * cd /opt/cgbasv2 && docker exec cgbas-mysql mysqldump -u root -pYOUR_PASSWORD cgbas_db | gzip > /opt/backups/cgbas_$(date +\%Y\%m\%d).sql.gz

# Xóa backup cũ hơn 7 ngày
0 3 * * * find /opt/backups -name "cgbas_*.sql.gz" -mtime +7 -delete
```
