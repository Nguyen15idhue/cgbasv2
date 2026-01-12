# 🛡️ Hướng dẫn Deploy AN TOÀN trên VPS đã có Docker

> **Dành cho VPS đã có dịch vụ đang chạy - Đảm bảo không ảnh hưởng đến hệ thống hiện tại**

## 📋 Mục lục

1. [Kiểm tra hệ thống hiện tại](#1-kiểm-tra-hệ-thống-hiện-tại)
2. [Chuẩn bị an toàn](#2-chuẩn-bị-an-toàn)
3. [Upload mã nguồn](#3-upload-mã-nguồn)
4. [Cấu hình tránh xung đột](#4-cấu-hình-tránh-xung-đột)
5. [Deploy production](#5-deploy-production)
6. [Kiểm tra và giám sát](#6-kiểm-tra-và-giám-sát)
7. [Rollback nếu cần](#7-rollback-nếu-cần)

---

## 1. Kiểm tra hệ thống hiện tại

### 1.1. Kiểm tra các port đang sử dụng

```bash
# SSH vào VPS
ssh user@your-vps-ip

# Kiểm tra port đang listen
sudo netstat -tulpn | grep LISTEN

# Hoặc dùng ss
sudo ss -tulpn | grep LISTEN

# Liệt kê các port Docker đang expose
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Ghi chú**: Ứng dụng CGBAS mặc định dùng port `3000` và `3306`. Nếu bị trùng, bạn cần đổi port.

### 1.2. Kiểm tra Docker networks hiện có

```bash
# Liệt kê networks
docker network ls

# Xem chi tiết network
docker network inspect bridge
```

### 1.3. Kiểm tra dung lượng đĩa

```bash
# Kiểm tra dung lượng còn trống
df -h

# Kiểm tra Docker disk usage
docker system df
```

---

## 2. Chuẩn bị an toàn

### 2.1. Backup dữ liệu hiện tại (QUAN TRỌNG!)

```bash
# Tạo thư mục backup
mkdir -p ~/backups/$(date +%Y%m%d)

# Backup Docker volumes hiện có (nếu có)
docker volume ls
# docker run --rm -v volume_name:/data -v ~/backups:/backup alpine tar czf /backup/volume_backup.tar.gz /data

# Backup database nếu có
# mysqldump -u root -p database_name > ~/backups/$(date +%Y%m%d)/database.sql
```

### 2.2. Tạo thư mục riêng cho dự án

```bash
# Tạo thư mục cho CGBAS (không trùng với dự án khác)
mkdir -p ~/apps/cgbasv2
cd ~/apps/cgbasv2
```

### 2.3. Kiểm tra tài nguyên

```bash
# Kiểm tra RAM còn trống
free -h

# Kiểm tra CPU load
top
# Hoặc
htop
```

---

## 3. Upload mã nguồn

### 3.1. Sử dụng Git (Khuyến nghị)

```bash
cd ~/apps/cgbasv2

# Clone repository
git clone <your-repo-url> .

# Hoặc nếu repo private:
# git clone https://username:token@github.com/username/repo.git .
```

### 3.2. Hoặc upload bằng SCP từ máy local

```bash
# Trên máy local Windows (PowerShell)
# Nén project (loại bỏ node_modules, logs)
tar -czf cgbasv2.tar.gz --exclude=node_modules --exclude=src/logs --exclude=.git .

# Upload lên VPS
scp cgbasv2.tar.gz user@your-vps-ip:~/apps/cgbasv2/

# Trên VPS, giải nén
cd ~/apps/cgbasv2
tar -xzf cgbasv2.tar.gz
rm cgbasv2.tar.gz
```

### 3.3. Hoặc dùng SFTP client (WinSCP, FileZilla)

- Kết nối đến VPS qua SFTP
- Upload toàn bộ thư mục (trừ `node_modules`, `src/logs`)

---

## 4. Cấu hình tránh xung đột

### 4.1. Đổi port nếu bị trùng

Kiểm tra file `docker-compose.yml`:

```bash
cd ~/apps/cgbasv2
nano docker-compose.yml
```

**Đổi port mapping** nếu `3000` hoặc `3306` đã bị dùng:

```yaml
services:
  mysql:
    ports:
      - "3307:3306"  # Đổi từ 3306 thành 3307 nếu MySQL đang chạy
  
  app-prod:
    ports:
      - "3001:3000"  # Đổi từ 3000 thành 3001 nếu port 3000 đã dùng
```

### 4.2. Đổi tên network để tránh conflict

```yaml
networks:
  cgbas-network:
    name: cgbasv2_net  # Thêm tên cụ thể
    driver: bridge
```

### 4.3. Đổi tên volumes

```yaml
volumes:
  mysql_data:
    name: cgbasv2_mysql_data  # Tên cụ thể
  logs_data:
    name: cgbasv2_logs_data
```

### 4.4. Đổi container names

```yaml
services:
  mysql:
    container_name: cgbasv2-mysql  # Thay vì cgbas-mysql
  
  app-prod:
    container_name: cgbasv2-app-prod
```

### 4.5. Tạo file .env

```bash
cd ~/apps/cgbasv2
cp .env.example .env
nano .env
```

**Cấu hình production environment**:

```env
# Database - Sử dụng password MẠNH
DB_HOST=mysql
DB_USER=cgbas
DB_PASS=YOUR_STRONG_PASSWORD_HERE_min_16_chars
DB_NAME=cgbas_db

# Session Secret - Tạo key ngẫu nhiên
SESSION_SECRET=$(openssl rand -base64 32)

# CGBAS API
AK=your_actual_ak
SK=your_actual_sk
API_BASE_URL=http://your-cgbas-api-url

# eWelink API
EWELINK_APPID=your_appid
EWELINK_APPSECRET=your_appsecret
EWELINK_TOKEN=your_token
EWELINK_REFRESHTOKEN=your_refresh_token
EWELINK_API=https://as-apia.coolkit.cc
```

**Sinh SESSION_SECRET ngẫu nhiên**:

```bash
openssl rand -base64 32
# Copy kết quả và paste vào .env
```

### 4.6. Bảo mật file .env

```bash
# Chỉ owner được đọc
chmod 600 .env

# Kiểm tra
ls -la .env
```

---

## 5. Deploy production

### 5.1. Pull images và build

```bash
cd ~/apps/cgbasv2

# Pull base images trước
docker pull mysql:8.0-debian
docker pull node:20-alpine

# Build image (production)
docker-compose build --no-cache app-prod
```

### 5.2. Khởi động containers (production mode)

```bash
# Khởi động với profile production
docker-compose --profile prod up -d

# Hoặc chỉ định file docker-compose nếu cần
# docker-compose -f docker-compose.yml --profile prod up -d
```

### 5.3. Kiểm tra containers đang chạy

```bash
# Xem containers
docker-compose ps

# Hoặc
docker ps -a | grep cgbas

# Kiểm tra logs
docker-compose logs -f app-prod

# Xem logs MySQL
docker-compose logs mysql
```

### 5.4. Đợi MySQL healthy

```bash
# Kiểm tra health status
docker inspect cgbasv2-mysql --format='{{.State.Health.Status}}'

# Nếu healthy -> OK
# Nếu unhealthy -> Xem logs:
docker-compose logs mysql
```

### 5.5. Kiểm tra ứng dụng hoạt động

```bash
# Test health endpoint
curl http://localhost:3001/health
# (Thay 3001 bằng port bạn đã cấu hình)

# Kết quả mong đợi:
# {"status":"ok","timestamp":"...","uptime":...}
```

---

## 6. Kiểm tra và giám sát

### 6.1. Xem logs realtime

```bash
# Logs ứng dụng
docker-compose logs -f app-prod

# Logs MySQL
docker-compose logs -f mysql

# Logs cả 2
docker-compose logs -f
```

### 6.2. Kiểm tra tài nguyên

```bash
# CPU, Memory usage của containers
docker stats

# Chi tiết container cụ thể
docker stats cgbasv2-app-prod cgbasv2-mysql
```

### 6.3. Kiểm tra kết nối database

```bash
# Vào MySQL CLI
docker exec -it cgbasv2-mysql mysql -ucgbas -p

# Sau khi nhập password:
SHOW DATABASES;
USE cgbas_db;
SHOW TABLES;
SELECT COUNT(*) FROM stations;
EXIT;
```

### 6.4. Test từ bên ngoài (nếu đã mở port)

```bash
# Từ máy local
curl http://your-vps-ip:3001/health
```

---

## 7. Rollback nếu cần

### 7.1. Dừng containers

```bash
cd ~/apps/cgbasv2

# Dừng containers
docker-compose --profile prod down

# Kiểm tra đã dừng
docker ps -a | grep cgbas
```

### 7.2. Xóa volumes nếu muốn reset dữ liệu

```bash
# CẢNH BÁO: Lệnh này sẽ XÓA DỮ LIỆU!
docker-compose --profile prod down -v

# Hoặc xóa volume cụ thể:
# docker volume rm cgbasv2_mysql_data
# docker volume rm cgbasv2_logs_data
```

### 7.3. Restore backup (nếu cần)

```bash
# Khôi phục database backup
docker exec -i cgbasv2-mysql mysql -ucgbas -pYOUR_PASSWORD cgbas_db < ~/backups/database.sql
```

---

## 8. Setup Nginx Reverse Proxy (Optional)

### 8.1. Cài đặt Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### 8.2. Tạo config cho CGBAS

```bash
sudo nano /etc/nginx/sites-available/cgbas
```

**Nội dung file**:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Thay bằng domain của bạn

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3001;  # Port container của bạn
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Logs
    access_log /var/log/nginx/cgbas_access.log;
    error_log /var/log/nginx/cgbas_error.log;
}
```

### 8.3. Kích hoạt site

```bash
# Tạo symbolic link
sudo ln -s /etc/nginx/sites-available/cgbas /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 8.4. Setup SSL với Certbot

```bash
# Cài đặt Certbot
sudo apt install -y certbot python3-certbot-nginx

# Tự động cấu hình SSL
sudo certbot --nginx -d your-domain.com

# Auto-renew SSL
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## 9. Auto Start on Boot

Docker containers với `restart: always` hoặc `restart: unless-stopped` sẽ tự động khởi động khi VPS reboot.

### 9.1. Kiểm tra restart policy

```bash
docker inspect cgbasv2-app-prod --format='{{.HostConfig.RestartPolicy.Name}}'
# Kết quả: always hoặc unless-stopped
```

### 9.2. Test reboot

```bash
# Reboot VPS (cẩn thận!)
sudo reboot

# Sau khi reboot, SSH lại và kiểm tra
docker ps

# Containers sẽ tự động start
```

---

## 10. Bảo mật bổ sung

### 10.1. Đổi mật khẩu MySQL admin

```bash
docker exec -it cgbasv2-mysql mysql -u root -p

# Trong MySQL CLI:
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_strong_password';
ALTER USER 'cgbas'@'%' IDENTIFIED BY 'new_strong_password';
FLUSH PRIVILEGES;
EXIT;

# Cập nhật lại .env với password mới
```

### 10.2. Đổi mật khẩu admin app

```bash
# Vào database
docker exec -it cgbasv2-mysql mysql -ucgbas -p

USE cgbas_db;

# Tạo hash password mới (sử dụng bcrypt online hoặc Node.js)
# Ví dụ: new_password_hash

UPDATE users SET password='$2a$10$...' WHERE username='admin';
EXIT;
```

### 10.3. Giới hạn truy cập MySQL

Chỉ cho phép app container kết nối đến MySQL:

```yaml
# docker-compose.yml
services:
  mysql:
    ports:
      - "127.0.0.1:3307:3306"  # Chỉ bind localhost
```

### 10.4. Setup fail2ban (optional)

```bash
sudo apt install -y fail2ban

# Cấu hình bảo vệ SSH
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 11. Monitoring & Logs

### 11.1. Xem logs ứng dụng

```bash
# Logs trong container
docker exec cgbasv2-app-prod ls -lh /app/src/logs/

# Xem file log
docker exec cgbasv2-app-prod tail -f /app/src/logs/app-*.log

# Hoặc mount volume và xem từ host
```

### 11.2. Setup log rotation

```bash
# Docker tự động rotate logs
docker inspect cgbasv2-app-prod --format='{{.HostConfig.LogConfig}}'

# Cấu hình trong docker-compose.yml
services:
  app-prod:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 11.3. Monitor disk usage

```bash
# Kiểm tra disk usage
docker system df

# Clean up
docker system prune -a --volumes  # CẢNH BÁO: Xóa tất cả unused data!
```

---

## 12. Backup tự động

### 12.1. Tạo script backup

```bash
mkdir -p ~/scripts
nano ~/scripts/backup-cgbas.sh
```

**Nội dung**:

```bash
#!/bin/bash

# Config
BACKUP_DIR=~/backups/cgbas
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="cgbasv2-mysql"
DB_USER="cgbas"
DB_PASS="YOUR_PASSWORD"
DB_NAME="cgbas_db"

# Tạo thư mục backup
mkdir -p $BACKUP_DIR

# Backup database
docker exec $CONTAINER_NAME mysqldump -u$DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# Backup volumes
docker run --rm -v cgbasv2_mysql_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/mysql_volume_$DATE.tar.gz /data
docker run --rm -v cgbasv2_logs_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/logs_volume_$DATE.tar.gz /data

# Xóa backup cũ hơn 7 ngày
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Cấp quyền thực thi**:

```bash
chmod +x ~/scripts/backup-cgbas.sh
```

### 12.2. Setup cron job

```bash
# Mở crontab
crontab -e

# Thêm dòng này (backup mỗi ngày lúc 2:00 AM)
0 2 * * * /home/youruser/scripts/backup-cgbas.sh >> /home/youruser/logs/backup.log 2>&1
```

---

## 13. Update ứng dụng

### 13.1. Pull code mới

```bash
cd ~/apps/cgbasv2

# Backup trước
./scripts/backup-cgbas.sh

# Pull code mới
git pull origin main
```

### 13.2. Rebuild và restart

```bash
# Rebuild image
docker-compose build --no-cache app-prod

# Restart container
docker-compose --profile prod up -d --force-recreate app-prod

# Kiểm tra logs
docker-compose logs -f app-prod
```

---

## 14. Troubleshooting

### 14.1. Container không start

```bash
# Xem logs chi tiết
docker-compose logs app-prod

# Kiểm tra inspect
docker inspect cgbasv2-app-prod
```

### 14.2. Không kết nối được database

```bash
# Kiểm tra MySQL logs
docker-compose logs mysql

# Test kết nối
docker exec cgbasv2-app-prod ping mysql
```

### 14.3. Port bị chiếm

```bash
# Tìm process đang dùng port
sudo lsof -i :3000
sudo netstat -tulpn | grep 3000

# Kill process nếu cần
sudo kill -9 <PID>
```

### 14.4. Disk full

```bash
# Xóa unused Docker resources
docker system prune -a

# Xóa old logs
docker exec cgbasv2-app-prod find /app/src/logs -name "*.log" -mtime +30 -delete
```

---

## 15. Checklist Deploy

- [ ] ✅ Backup dữ liệu hiện có
- [ ] ✅ Kiểm tra port không bị trùng
- [ ] ✅ Cấu hình .env với password mạnh
- [ ] ✅ Đổi SESSION_SECRET
- [ ] ✅ Test containers trên VPS
- [ ] ✅ Setup Nginx reverse proxy
- [ ] ✅ Cấu hình SSL
- [ ] ✅ Setup firewall
- [ ] ✅ Cấu hình auto-restart
- [ ] ✅ Setup backup tự động
- [ ] ✅ Đổi mật khẩu admin
- [ ] ✅ Test truy cập từ bên ngoài
- [ ] ✅ Monitor logs 24h đầu

---

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. **Logs**: `docker-compose logs -f`
2. **System resources**: `docker stats`
3. **Network**: `docker network inspect cgbas-network`
4. **Firewall**: `sudo ufw status`

---

**Chúc deploy thành công! 🚀**
