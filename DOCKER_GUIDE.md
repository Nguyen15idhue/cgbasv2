# 🐳 Docker Deployment Guide

## 📦 Tính năng

- ✅ **Multi-stage build** - Image production cực nhẹ (~150MB)
- ✅ **Alpine Linux** - Base image nhỏ nhất, tiêu thụ ít CPU/RAM
- ✅ **Non-root user** - Bảo mật cao cho production
- ✅ **Health check** - Tự động kiểm tra và restart nếu lỗi
- ✅ **Signal handling** - Graceful shutdown với tini/dumb-init
- ✅ **MySQL included** - Database tự động setup
- ✅ **Volume persistence** - Data không bị mất khi restart

---

## 📋 Quy trình làm việc với Docker - Từ A đến Z

### 🎬 **1. BẮT ĐẦU DỰ ÁN (Lần đầu tiên)**

#### Bước 1.1: Chuẩn bị môi trường
```bash
# Kiểm tra Docker đã cài chưa
docker --version
docker-compose --version

# Clone project (nếu chưa có)
git clone <repository-url>
cd cgbasv2

# Tạo file .env từ template
cp .env.example .env

# Chỉnh sửa các biến môi trường
nano .env  # hoặc code .env
```

#### Bước 1.2: Khởi động lần đầu (Development)
```bash
# Build image và khởi động containers
docker-compose --profile dev up -d --build

# Kiểm tra trạng thái
docker-compose ps

# Xem logs để đảm bảo không có lỗi
docker-compose logs -f app-dev

# Kiểm tra MySQL đã sẵn sàng
docker exec cgbas-mysql mysqladmin ping -h localhost -u root -p

# Truy cập ứng dụng
# Browser: http://localhost:3000
```

#### Bước 1.3: Khởi động Production (lần đầu)
```bash
# Build production image
docker-compose --profile prod build --no-cache

# Khởi động production
docker-compose --profile prod up -d

# Verify health check
docker inspect --format='{{.State.Health.Status}}' cgbas-app-prod

# Xem logs production
docker-compose logs -f app-prod
```

---

### 🔧 **2. PHÁT TRIỂN & CHỈNH SỬA (Development Workflow)**

#### Bước 2.1: Sửa code (Hot Reload)
```bash
# Development mode tự động reload khi code thay đổi
# Chỉ cần edit file, không cần restart

# Nếu cần restart manual
docker-compose restart app-dev

# Xem logs real-time
docker-compose logs -f --tail=50 app-dev
```

#### Bước 2.2: Thêm dependencies mới
```bash
# Thêm package vào package.json
# Sau đó rebuild container

docker-compose --profile dev down
docker-compose --profile dev up -d --build

# Hoặc chỉ rebuild service app
docker-compose build app-dev
docker-compose up -d app-dev
```

#### Bước 2.3: Migration Database
```bash
# Thêm file migration mới trong src/migrations/
# VD: 006_add_new_table.sql

# Restart MySQL để auto-run migration
docker-compose restart mysql

# Hoặc chạy manual
docker exec -i cgbas-mysql mysql -u root -p cgbas_db < src/migrations/006_add_new_table.sql
```

#### Bước 2.4: Kiểm tra lỗi
```bash
# Xem logs có lỗi không
docker-compose logs --tail=100 app-dev | grep -i error

# Access shell trong container để debug
docker exec -it cgbas-app-dev sh

# Trong container, có thể:
cd /app
ls -la
cat logs/error.log
node --version
npm list
```

#### Bước 2.5: Test thay đổi
```bash
# Stop và start lại để test clean state
docker-compose --profile dev down
docker-compose --profile dev up -d

# Xem resource usage
docker stats cgbas-app-dev cgbas-mysql
```

---

### 🚀 **3. DEPLOY PRODUCTION (Sau khi dev xong)**

#### Bước 3.1: Build Production Image
```bash
# Stop development trước (optional)
docker-compose --profile dev down

# Build production image mới (no cache)
docker-compose --profile prod build --no-cache

# Verify image size
docker images | grep cgbasv2
```

#### Bước 3.2: Deploy Production
```bash
# Khởi động production
docker-compose --profile prod up -d

# Monitor startup process
docker-compose logs -f app-prod

# Đợi health check pass (30-60s)
watch -n 2 'docker inspect --format="{{.State.Health.Status}}" cgbas-app-prod'
```

#### Bước 3.3: Verify Production
```bash
# Kiểm tra containers đang chạy
docker-compose ps

# Test API endpoint
curl http://localhost:3000/health
curl http://localhost:3000/api/auth/status

# Kiểm tra resource usage
docker stats cgbas-app-prod
```

---

### 🔄 **4. CẬP NHẬT SAU KHI CHỈNH SỬA**

#### Bước 4.1: Pull code mới (từ Git)
```bash
# Stop containers trước
docker-compose --profile prod down

# Pull latest code
git pull origin main

# Rebuild với code mới
docker-compose --profile prod build --no-cache
docker-compose --profile prod up -d
```

#### Bước 4.2: Update chỉ code (không build lại)
```bash
# Nếu chỉ sửa file JS/CSS và muốn hot reload
# Development mode tự động reload

# Production cần restart
docker-compose restart app-prod
```

#### Bước 4.3: Update dependencies
```bash
# Sửa package.json
# Rebuild image hoàn toàn
docker-compose --profile prod down
docker-compose --profile prod build --no-cache
docker-compose --profile prod up -d
```

#### Bước 4.4: Rollback nếu có lỗi
```bash
# Stop production hiện tại
docker-compose --profile prod down

# Checkout code cũ
git checkout <previous-commit-hash>

# Rebuild với code cũ
docker-compose --profile prod build --no-cache
docker-compose --profile prod up -d
```

---

### 🗄️ **5. QUẢN LÝ DATABASE**

#### Backup Database
```bash
# Backup toàn bộ database
docker exec cgbas-mysql mysqldump -u root -p cgbas_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup với gzip (tiết kiệm dung lượng)
docker exec cgbas-mysql mysqldump -u root -p cgbas_db | gzip > backup_$(date +%Y%m%d).sql.gz

# Backup tự động (cron job)
# Thêm vào crontab: 0 2 * * * /path/to/backup.sh
```

#### Restore Database
```bash
# Restore từ file .sql
docker exec -i cgbas-mysql mysql -u root -p cgbas_db < backup_20260117.sql

# Restore từ file .gz
gunzip < backup_20260117.sql.gz | docker exec -i cgbas-mysql mysql -u root -p cgbas_db

# Restore và tạo database mới
docker exec -i cgbas-mysql mysql -u root -p -e "CREATE DATABASE cgbas_db_test;"
docker exec -i cgbas-mysql mysql -u root -p cgbas_db_test < backup.sql
```

#### Truy cập MySQL Console
```bash
# Vào MySQL CLI
docker exec -it cgbas-mysql mysql -u root -p

# Các lệnh SQL hữu ích:
# SHOW DATABASES;
# USE cgbas_db;
# SHOW TABLES;
# DESCRIBE stations;
# SELECT COUNT(*) FROM station_recovery_jobs;
```

---

### 🛑 **6. KẾT THÚC / DỌN DẸP**

#### Bước 6.1: Stop containers (giữ data)
```bash
# Stop tất cả services
docker-compose down

# Stop chỉ một profile
docker-compose --profile dev down
docker-compose --profile prod down

# Stop nhưng giữ volumes
docker-compose down

# Xóa container cụ thể (an toàn, không mất data)
docker rm cgbas-app-dev         # Xóa dev container
docker rm cgbas-app-prod        # Xóa prod container
# Lưu ý: Chỉ xóa container đang stopped, nếu đang chạy thêm -f
docker rm -f cgbas-app-dev
```

**Xóa app-dev có an toàn không?**
- ✅ **An toàn 100%**: Không ảnh hưởng app-prod và MySQL
- ✅ **Data không mất**: Database vẫn nguyên trong volumes
- ✅ **Code không mất**: Source code vẫn ở `/opt/cgbasv2`
- ✅ **Tạo lại dễ dàng**: Chạy `docker-compose --profile dev up -d` là có lại
- ✅ **Tiết kiệm tài nguyên**: Giảm dung lượng disk

**Giải thích:**
- `cgbas-app-dev`: Container ứng dụng Node.js (CHỈ CODE, không có data)
- `cgbas-app-prod`: Container ứng dụng Node.js production (CHỈ CODE)
- `cgbas-mysql`: Container database (chứa DATA) ← **KHÔNG XÓA CÁI NÀY**
- Docker volumes: Nơi lưu database thực sự ← **KHÔNG XÓA CÁI NÀY**

**Xóa app-dev = Xóa container chạy code Node.js, KHÔNG động đến database!**

**Khi nào nên xóa app-dev?**
- VPS chỉ chạy production → Xóa dev để tiết kiệm
- Port conflict → Xóa dev, chỉ giữ prod
- Không cần develop trên VPS → Xóa dev

**Dọn dẹp dev trên VPS (Recommended):**
```bash
# Bước 1: Xóa container dev
docker rm -f cgbas-app-dev

# Bước 2: Xóa image dev (tiết kiệm ~350MB)
docker rmi cgbasv2-app-dev

# Bước 3: Verify chỉ còn prod
docker ps -a | grep cgbas
# Kết quả mong muốn: chỉ thấy cgbas-app-prod và cgbas-mysql

# Bước 4: ⚠️ KHÔNG chạy docker image prune -a (sẽ xóa base images!)
# Thay vào đó chỉ xóa dangling images:
docker image prune

# Bước 5: Restart prod để đảm bảo chạy tốt
docker restart cgbas-app-prod
```

**⚠️ LƯU Ý KHI DÙNG `docker image prune -a`:**
- Lệnh này xóa **TẤT CẢ** images không được dùng bởi container đang chạy
- Có thể xóa nhầm MySQL image, Node image (base images cần thiết)
- Nếu container restart, sẽ không start được vì thiếu image!
- **An toàn hơn**: Chỉ dùng `docker image prune` (không có -a)

**Nếu đã xóa nhầm base images:**
```bash
# Pull lại MySQL image
docker pull mysql:8.0-debian

# Pull lại Node image  
docker pull node:18-alpine

# Verify đã có lại
docker images | grep -E "mysql|node"
```

#### Bước 6.2: Stop và xóa volumes (XÓA DATA!)
```bash
# ⚠️ CẢNH BÁO: Lệnh này sẽ XÓA HẾT DATA trong database!

# Backup trước khi xóa
docker exec cgbas-mysql mysqldump -u root -p cgbas_db > backup_before_clean.sql

# Xóa containers và volumes
docker-compose down -v

# Xác nhận volumes đã xóa
docker volume ls | grep cgbasv2
```

#### Bước 6.3: Xóa images (để build lại từ đầu)
```bash
# List images
docker images | grep cgbasv2

# Xóa specific image
docker rmi cgbasv2-app-dev
docker rmi cgbasv2-app-prod

# Xóa tất cả images không dùng
docker image prune -a

# Clean toàn bộ Docker system
docker system prune -a --volumes
```

#### Bước 6.4: Dọn dẹp hoàn toàn
```bash
# Stop tất cả
docker-compose down -v

# Xóa images
docker rmi $(docker images 'cgbasv2*' -q)

# Xóa networks
docker network prune

# Xóa volumes
docker volume prune

# Clean system
docker system prune -a --volumes
```

---

### 🔍 **7. DEBUGGING & TROUBLESHOOTING**

#### Xem logs chi tiết
```bash
# Logs real-time tất cả services
docker-compose logs -f

# Logs chỉ app-prod
docker-compose logs -f --tail=200 app-prod

# Logs MySQL
docker-compose logs -f mysql

# Lọc logs có keyword
docker-compose logs app-prod | grep "ERROR"
docker-compose logs app-prod | grep "Job"
```

#### Kiểm tra container health
```bash
# Status tất cả containers
docker-compose ps

# Health của một container
docker inspect cgbas-app-prod | grep -A 10 Health

# Resource usage real-time
docker stats

# Chi tiết một container
docker inspect cgbas-app-prod
```

#### Access container để debug
```bash
# Vào shell của app container
docker exec -it cgbas-app-prod sh

# Vào MySQL container
docker exec -it cgbas-mysql bash

# Chạy lệnh one-time
docker exec cgbas-app-prod ls -la /app
docker exec cgbas-app-prod cat /app/logs/error.log
docker exec cgbas-app-prod node -v
```

#### Kiểm tra network
```bash
# List networks
docker network ls

# Inspect network
docker network inspect cgbasv2_cgbas-network

# Test connection giữa containers
docker exec cgbas-app-prod ping mysql
docker exec cgbas-app-prod nc -zv mysql 3306
```

#### Container restart liên tục
```bash
# Xem lý do restart
docker inspect cgbas-app-prod | grep -A 5 "RestartCount"

# Xem exit code
docker inspect cgbas-app-prod | grep "ExitCode"

# Stop auto-restart để debug
docker update --restart=no cgbas-app-prod

# Xem logs trước khi crash
docker logs --tail=500 cgbas-app-prod
```

---

### 📊 **8. MONITORING & MAINTENANCE**

#### Health Check
```bash
# Manual health check
curl http://localhost:3000/health

# Check từ trong container
docker exec cgbas-app-prod wget -qO- http://localhost:3000/health

# Monitor health status
watch -n 5 'docker inspect --format="{{.State.Health.Status}}" cgbas-app-prod'
```

#### Resource Monitoring
```bash
# Real-time stats
docker stats

# Stats của một container
docker stats cgbas-app-prod --no-stream

# Disk usage
docker system df

# Detailed disk usage
docker system df -v
```

#### Log Rotation
```bash
# Kiểm tra log size
docker inspect cgbas-app-prod | grep LogPath
du -sh $(docker inspect cgbas-app-prod | grep LogPath | cut -d'"' -f4)

# Truncate logs (nếu quá lớn)
truncate -s 0 $(docker inspect cgbas-app-prod | grep LogPath | cut -d'"' -f4)

# Configure log rotation trong docker-compose.yml
# logging:
#   driver: "json-file"
#   options:
#     max-size: "10m"
#     max-file: "3"
```

---

### 🎯 **9. PRODUCTION BEST PRACTICES**

#### Pre-deployment Checklist
```bash
# 1. Backup database
docker exec cgbas-mysql mysqldump -u root -p cgbas_db > backup_pre_deploy.sql

# 2. Test build locally
docker-compose --profile prod build --no-cache

# 3. Run tests (nếu có)
docker-compose run --rm app-prod npm test

# 4. Check .env variables
cat .env | grep -v "^#"

# 5. Verify ports không conflict
netstat -an | grep 3000
netstat -an | grep 3306
```

#### Zero-downtime Deployment
```bash
# 1. Start new version với port khác
# Edit docker-compose.yml: ports: "3001:3000"
docker-compose -f docker-compose.prod.yml up -d

# 2. Health check new version
curl http://localhost:3001/health

# 3. Switch traffic (Nginx/Load Balancer)

# 4. Stop old version
docker stop cgbas-app-prod-old
```

#### Regular Maintenance
```bash
# Weekly: Backup database
# Daily: Check logs
docker-compose logs --tail=100 app-prod | grep -i error

# Monthly: Clean unused images
docker image prune -a

# Monthly: Update base images
docker-compose pull
docker-compose --profile prod up -d --build
```

---

---

## 🚀 Quick Start (TL;DR)

### Development Mode
```bash
docker-compose --profile dev up -d
```

### Production Mode
```bash
docker-compose --profile prod up -d --build
```

### Stop Everything
```bash
docker-compose down
```

---

## 🚀 Chạy Development

```bash
# Build và chạy development
docker-compose --profile dev up -d

# Xem logs
docker-compose logs -f app-dev

# Stop
docker-compose --profile dev down
```

**Development mode features:**
- Hot reload khi code thay đổi
- Volume mount toàn bộ source code
- Debug logs chi tiết
- Port: `http://localhost:3000`

## 🎯 Chạy Production

```bash
# Build và chạy production
docker-compose --profile prod up -d --build

# Xem logs
docker-compose logs -f app-prod

# Stop
docker-compose --profile prod down
```

**Production mode features:**
- Image đã optimize (~150MB)
- Chạy với non-root user
- CPU limit: 1 core, RAM limit: 512MB
- Health check tự động
- Auto restart on failure

## 📊 Resource Limits

### Development
- Không giới hạn (thoải mái debug)

### Production
- **CPU**: 1 core max (reserved 0.5 core)
- **RAM**: 512MB max (reserved 256MB)
- **Disk**: Chỉ logs được persist

## 🔧 Configuration

### 1. Setup environment variables

```bash
# Copy template
cp .env.example .env

# Edit với editor của bạn
nano .env
```

### 2. Database sẽ tự động migrate

Migration SQL trong `src/migrations/` sẽ tự động chạy lần đầu khởi động MySQL.

### 3. Access application

- App: `http://localhost:3000`
- MySQL: `localhost:3306`

Default login:
- Username: `admin`
- Password: `admin123`

## 📝 Useful Commands

```bash
# Xem tất cả containers
docker-compose ps

# Restart service
docker-compose restart app-prod

# Rebuild image
docker-compose build --no-cache

# Xem resource usage
docker stats

# Access shell trong container
docker exec -it cgbas-app-prod sh

# Backup MySQL
docker exec cgbas-mysql mysqldump -u root -p cgbas_db > backup.sql

# Restore MySQL
docker exec -i cgbas-mysql mysql -u root -p cgbas_db < backup.sql

# Clean all (WARNING: Xóa data!)
docker-compose down -v
```

## 🔍 Monitoring

### Check health status
```bash
docker inspect --format='{{.State.Health.Status}}' cgbas-app-prod
```

### View logs with filter
```bash
# Production logs
docker-compose logs -f --tail=100 app-prod

# MySQL logs
docker-compose logs -f --tail=50 mysql

# All services
docker-compose logs -f
```

## 🚨 Troubleshooting

### Không thấy logs khi chạy docker-compose logs
```bash
# Bước 1: Kiểm tra container status
docker ps -a | grep cgbas

# Nếu thấy status "Created" (chưa start):
docker-compose --profile dev up -d
# Hoặc
docker start cgbas-app-dev

# Nếu thấy status "Up" nhưng không có logs:
docker-compose logs -f app-dev
docker logs -f cgbas-app-dev

# Nếu thấy status "Exited" (đã stop hoặc crash):
# Xem lỗi gì khiến container bị stop
docker logs cgbas-app-dev
# Restart lại
docker-compose --profile dev up -d
```

**Giải thích các status:**
- **Created**: Container đã tạo nhưng chưa start → Cần `docker start`
- **Up**: Container đang chạy bình thường
- **Exited**: Container đã stop (có thể do lỗi) → Xem logs để biết lý do
- **Restarting**: Container đang tự restart liên tục → Có lỗi nghiêm trọng

### Port conflict: "Bind for 0.0.0.0:3001 failed: port is already allocated"
```bash
# Kiểm tra container nào đang dùng port
docker ps | grep 3001

# Option 1: Chỉ chạy dev (stop prod trước)
docker stop cgbas-app-prod
docker-compose --profile dev up -d

# Option 2: Chỉ chạy prod (recommended)
docker stop cgbas-app-dev
docker start cgbas-app-prod
# hoặc
docker-compose --profile prod up -d

# Option 3: Đổi port trong docker-compose.yml
# app-dev: "3000:3000"
# app-prod: "3001:3001"

# Kiểm tra port đang được dùng
netstat -tulpn | grep :3001
lsof -i :3001
```

**Lưu ý**: Không nên chạy cả dev và prod cùng lúc trên VPS. Chọn một trong hai:
- Development: dùng profile `dev`
- Production: dùng profile `prod`

### Container status "unhealthy" nhưng app vẫn chạy bình thường
```bash
# Check tại sao unhealthy
docker inspect cgbas-app-prod | grep -A 20 Health

# Xem logs để tìm lỗi
docker logs --tail=200 cgbas-app-prod

# Test health endpoint manual
curl http://localhost:3001/health

# Nếu health endpoint trả về OK nhưng vẫn unhealthy
# → Kiểm tra healthcheck config trong Dockerfile hoặc docker-compose.yml

# Restart container
docker restart cgbas-app-prod
```

### App không start được (status "Exited" hoặc "Restarting")
```bash
# Check logs để xem lỗi
docker logs cgbas-app-prod

# Check health
docker inspect cgbas-app-prod

# Restart
docker-compose restart app-prod

# Nếu vẫn lỗi, rebuild
docker-compose --profile prod down
docker-compose --profile prod up -d --build
```

### MySQL connection error
```bash
# Check MySQL health
docker exec cgbas-mysql mysqladmin ping -h localhost

# Check network
docker network inspect cgbasv2_cgbas-network

# Restart MySQL
docker-compose restart mysql
```

### Out of memory
```bash
# Tăng memory limit trong docker-compose.yml
memory: 1G  # Thay vì 512M
```

## 🎛️ Advanced Configuration

### Tùy chỉnh resource limits

Edit `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'      # Tăng CPU
      memory: 1G       # Tăng RAM
    reservations:
      cpus: '1.0'
      memory: 512M
```

### Expose ra internet

Sử dụng Nginx reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📈 Performance Tips

1. **Giảm logs trong production** - Chỉnh log level trong Winston config
2. **Enable gzip** - Compress response để giảm bandwidth
3. **Use Redis for sessions** - Thay vì memory (nếu scale multiple instances)
4. **Database optimization** - Add indexes cho queries hay dùng

## 🔐 Security Checklist

- [x] Non-root user trong container
- [x] Environment variables không hardcode
- [x] Database password mạnh
- [x] SESSION_SECRET unique và random
- [x] Health check enabled
- [x] Resource limits set
- [ ] SSL/TLS với reverse proxy (nếu public)
- [ ] Firewall rules (nếu production server)

## 📦 Image Size Comparison

| Stage | Size | Use Case |
|-------|------|----------|
| Development | ~350MB | Local dev with tools |
| Production | ~150MB | Deploy production |
| Node base (Alpine) | 130MB | Base only |

## 🌟 Recommended Setup

### Local Development (Máy cá nhân)
```bash
docker-compose --profile dev up -d
```

### Production Server (VPS)
```bash
# ✅ VPS CHỈ CHẠY PRODUCTION
docker-compose --profile prod up -d --build

# ❌ KHÔNG chạy dev trên VPS (port conflict + tốn tài nguyên)
```

### Both (Testing - chỉ dùng local)
```bash
docker-compose --profile dev --profile prod up -d
```

**Best Practice:**
- 💻 **Local/Laptop**: Chạy `--profile dev` để develop
- 🚀 **VPS/Server**: Chỉ chạy `--profile prod`, xóa app-dev nếu có
- ⚠️ **Không bao giờ**: Chạy cả dev + prod trên VPS (port conflict)

---

## 💡 **CHEAT SHEET - Lệnh hay dùng nhất**

```bash
# === BẮT ĐẦU ===
docker-compose --profile dev up -d              # Start dev (LOCAL ONLY)
docker-compose --profile prod up -d --build     # Start prod (VPS)

# === CLEANUP DEV TRÊN VPS ===
docker rm -f cgbas-app-dev                      # Xóa dev container
docker rmi cgbasv2-app-dev                      # Xóa dev image

# === XEM LOGS ===
docker-compose logs -f app-dev                  # Logs dev
docker-compose logs -f app-prod                 # Logs prod
docker-compose logs -f --tail=100 app-prod      # 100 dòng cuối

# === RESTART ===
docker-compose restart app-dev                  # Restart dev
docker-compose restart app-prod                 # Restart prod
docker-compose restart mysql                    # Restart DB

# === REBUILD ===
docker-compose build --no-cache                 # Build lại tất cả
docker-compose --profile prod up -d --build     # Build + Start prod

# === DATABASE ===
docker exec cgbas-mysql mysqladmin ping -h localhost        # Check MySQL
docker exec -it cgbas-mysql mysql -u root -p               # Vào MySQL CLI
docker exec cgbas-mysql mysqldump -u root -p cgbas_db > backup.sql  # Backup

# === DEBUG ===
docker exec -it cgbas-app-prod sh               # Vào container shell
docker-compose ps                               # Xem status
docker stats                                    # Xem resource usage
docker inspect cgbas-app-prod                   # Chi tiết container

# === DỌN DẸP ===
docker-compose down                             # Stop (giữ data)
docker-compose down -v                          # Stop + XÓA DATA
docker system prune -a                          # Dọn dẹp tất cả
```

---

## 📞 Support

Nếu gặp vấn đề, check:
1. Docker logs: `docker-compose logs -f`
2. Container status: `docker-compose ps`
3. Resource usage: `docker stats`
4. Network: `docker network inspect cgbasv2_cgbas-network`
