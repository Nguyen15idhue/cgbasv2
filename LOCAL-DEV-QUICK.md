# 💻 LOCAL DEVELOPMENT - Cheat Sheet

## 🚀 Khởi động lần đầu

```bash
# Di chuyển vào thư mục project
cd C:\laragon\www\cgbasv2

# Copy file .env
cp .env.example .env

# Chỉnh sửa .env (API keys, passwords...)
code .env

# Khởi động Docker
docker-compose --profile dev up -d

# Xem logs
docker logs -f cgbas-app-dev
```

**Truy cập:** http://localhost:3001

---

## ✏️ Workflow chỉnh sửa code

### 1. Sửa file .js/.html/.css

```bash
# Chỉ cần edit file, container tự động reload (hot reload)
# Không cần restart!
```

**Lưu ý:** Dev mode đã bật nodemon, code thay đổi sẽ tự động restart.

### 2. Thêm/sửa package.json

```bash
# Sau khi sửa package.json, rebuild container
docker-compose --profile dev down
docker-compose --profile dev up -d --build
```

### 3. Thêm migration mới

```bash
# Tạo file trong src/migrations/
# VD: 007_add_new_feature.sql

# Restart để chạy migration
docker restart cgbas-mysql
sleep 5
docker restart cgbas-app-dev
```

### 4. Xem logs khi code có lỗi

```bash
# Xem logs real-time
docker logs -f cgbas-app-dev

# Xem 100 dòng cuối
docker logs --tail=100 cgbas-app-dev

# Lọc lỗi
docker logs cgbas-app-dev | grep -i error
```

---

## 🔍 Debug

### Vào container shell

```bash
# Vào container để debug
docker exec -it cgbas-app-dev sh

# Trong container:
cd /app
ls -la
cat src/logs/error.log
node --version
npm list
exit
```

### Check MySQL

```bash
# Vào MySQL CLI
docker exec -it cgbas-mysql mysql -u cgbas -p

# Trong MySQL:
SHOW DATABASES;
USE cgbas_db;
SHOW TABLES;
SELECT * FROM station_recovery_jobs;
exit;
```

### Restart từng service

```bash
# Restart app
docker restart cgbas-app-dev

# Restart MySQL
docker restart cgbas-mysql

# Restart tất cả
docker-compose --profile dev restart
```

---

## 🧪 Test code trước khi commit

```bash
# 1. Stop và start lại để test clean state
docker-compose --profile dev down
docker-compose --profile dev up -d

# 2. Xem logs có lỗi không
docker logs --tail=100 cgbas-app-dev | grep -i error

# 3. Test trên browser
# - Login: http://localhost:3001
# - Health: http://localhost:3001/health
# - Dashboard: Test các chức năng

# 4. Check resource usage
docker stats cgbas-app-dev cgbas-mysql
```

---

## 📤 Push code lên Git

```bash
# 1. Check file đã thay đổi
git status

# 2. Add files
git add .

# Hoặc add từng file cụ thể
git add src/services/stationControlService.js
git add update-vps.sh

# 3. Commit với message rõ ràng
git commit -m "fix: optimize retry intervals"

# 4. Push lên GitHub
git push origin main

# 5. Deploy lên VPS (xem VPS-UPDATE-QUICK.md)
```

---

## 🗄️ Database operations

### Backup local database

```bash
docker exec cgbas-mysql mysqldump -u cgbas -pYOUR_PASSWORD cgbas_db > backup_local_$(date +%Y%m%d).sql
```

### Restore database

```bash
docker exec -i cgbas-mysql mysql -u cgbas -pYOUR_PASSWORD cgbas_db < backup.sql
```

### Reset database (clean start)

```bash
# Xóa tất cả data và volumes
docker-compose --profile dev down -v

# Start lại (migration sẽ chạy từ đầu)
docker-compose --profile dev up -d
```

---

## 🛑 Stop/Clean

### Stop containers (giữ data)

```bash
docker-compose --profile dev down
```

### Xóa tất cả (bao gồm data)

```bash
# ⚠️ CẢNH BÁO: Lệnh này XÓA HẾT DATA!
docker-compose --profile dev down -v
```

### Dọn dẹp Docker

```bash
# Xóa images không dùng
docker image prune

# Xóa tất cả (containers, images, networks, volumes)
docker system prune -a
```

---

## 🆘 Fix lỗi thường gặp

### Port đã được dùng

```bash
# Kiểm tra port 3001
netstat -ano | findstr :3001

# Stop process đang dùng port
taskkill /PID <PID_NUMBER> /F

# Hoặc đổi port trong docker-compose.yml
```

### Container không start

```bash
# Xem lỗi
docker logs cgbas-app-dev

# Rebuild từ đầu
docker-compose --profile dev down
docker-compose --profile dev up -d --build
```

### MySQL connection error

```bash
# Restart MySQL
docker restart cgbas-mysql
sleep 10

# Restart app
docker restart cgbas-app-dev
```

### Code thay đổi nhưng không reload

```bash
# Restart manual
docker restart cgbas-app-dev

# Hoặc rebuild
docker-compose --profile dev down
docker-compose --profile dev up -d --build
```

### Hot reload không hoạt động

```bash
# Kiểm tra nodemon có chạy không
docker logs cgbas-app-dev | grep nodemon

# Nếu không có, rebuild
docker-compose build --no-cache app-dev
docker-compose --profile dev up -d
```

---

## 💡 Tips & Best Practices

### Shortcuts (Windows)

```powershell
# Tạo alias trong PowerShell profile
notepad $PROFILE

# Thêm vào:
function dockerup { docker-compose --profile dev up -d }
function dockerdown { docker-compose --profile dev down }
function dockerlogs { docker logs -f cgbas-app-dev }
function dockerrestart { docker restart cgbas-app-dev }

# Reload profile
. $PROFILE

# Sử dụng:
dockerup
dockerlogs
dockerrestart
dockerdown
```

### VS Code Extensions khuyến nghị

- Docker (Microsoft)
- GitLens
- ESLint
- Prettier
- MySQL (Weijan Chen)

### Workflow hiệu quả

1. **Sửa code** → Auto reload (không cần làm gì)
2. **Có lỗi** → Xem logs: `docker logs -f cgbas-app-dev`
3. **Xong feature** → Test → Commit → Push
4. **Deploy VPS** → Xem `VPS-UPDATE-QUICK.md`

---

## 📊 Monitoring local

```bash
# Xem resource usage real-time
docker stats

# Xem logs nhiều container
docker-compose logs -f

# Check health
curl http://localhost:3001/health

# Xem database size
docker exec cgbas-mysql mysql -u cgbas -pYOUR_PASSWORD -e "SELECT table_schema AS 'Database', ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' FROM information_schema.tables WHERE table_schema = 'cgbas_db';"
```

---

## 🔗 Useful Links

- Docker Dashboard: http://localhost (Docker Desktop)
- App: http://localhost:3001
- MySQL: localhost:3307 (dùng MySQL Workbench)

---

**Happy Coding! 💻✨**
