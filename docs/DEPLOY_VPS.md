# 🚀 Hướng dẫn Deploy lên VPS Ubuntu

## 📋 Yêu cầu

- VPS Ubuntu 20.04/22.04 (tối thiểu 1GB RAM, 1 CPU)
- Domain trỏ về IP VPS (optional, cho SSL)
- SSH access với quyền root hoặc sudo

## 🎯 Mục lục

1. [Chuẩn bị VPS](#1-chuẩn-bị-vps)
2. [Cài đặt Docker](#2-cài-đặt-docker)
3. [Clone Project](#3-clone-project)
4. [Cấu hình Environment](#4-cấu-hình-environment)
5. [Chạy Production](#5-chạy-production)
6. [Setup Nginx Reverse Proxy](#6-setup-nginx-reverse-proxy)
7. [SSL với Let's Encrypt](#7-ssl-với-lets-encrypt)
8. [Monitoring & Logs](#8-monitoring--logs)
9. [Auto Start on Boot](#9-auto-start-on-boot)
10. [Backup & Restore](#10-backup--restore)

---

## 1. Chuẩn bị VPS

### 1.1. Kết nối SSH vào VPS

```bash
ssh root@your-vps-ip
# Hoặc với user khác:
# ssh username@your-vps-ip
```

### 1.2. Update hệ thống

```bash
# Update package list
sudo apt update

# Upgrade packages
sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl git wget nano ufw
```

### 1.3. Tạo user mới (recommended, không dùng root)

```bash
# Tạo user
sudo adduser cgbas

# Add vào sudo group
sudo usermod -aG sudo cgbas

# Add vào docker group (sau khi cài docker)
sudo usermod -aG docker cgbas

# Switch sang user mới
su - cgbas
```

### 1.4. Setup Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 2. Cài đặt Docker

### 2.1. Cài Docker Engine

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version
```

### 2.2. Cài Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker-compose --version
```

### 2.3. Add user vào docker group

```bash
# Add current user to docker group
sudo usermod -aG docker $USER

# Apply changes (logout/login hoặc dùng newgrp)
newgrp docker

# Test docker without sudo
docker ps
```

---

## 3. Clone Project

### 3.1. Tạo thư mục project

```bash
# Tạo thư mục
sudo mkdir -p /opt/cgbasv2
sudo chown $USER:$USER /opt/cgbasv2
cd /opt/cgbasv2
```

### 3.2. Clone từ GitHub

```bash
# Clone repository
git clone https://github.com/Nguyen15idhue/cgbasv2.git .

# Check files
ls -la
```

### 3.3. Setup Git credentials (nếu private repo)

```bash
# Configure git
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Generate SSH key (nếu chưa có)
ssh-keygen -t ed25519 -C "your@email.com"

# Copy public key và add vào GitHub
cat ~/.ssh/id_ed25519.pub
```

---

## 4. Cấu hình Environment

### 4.1. Copy và edit .env file

```bash
# Copy template
cp .env.example .env

# Edit với nano
nano .env
```

### 4.2. Cấu hình .env cho Production

```bash
# Database Configuration
DB_HOST=mysql
DB_USER=cgbas
DB_PASS=STRONG_PASSWORD_HERE_123!@#
DB_NAME=cgbas_db

# Session Secret (IMPORTANT: Change this!)
SESSION_SECRET=$(openssl rand -base64 32)

# CGBAS API Configuration
AK=your_access_key
SK=your_secret_key
API_BASE_URL=http://your-api-url:8090

# Ewelink Configuration
EWELINK_APPID=your_ewelink_appid
EWELINK_APPSECRET=your_ewelink_appsecret
EWELINK_TOKEN=your_ewelink_token
EWELINK_REFRESHTOKEN=your_ewelink_refreshtoken
EWELINK_API=https://as-apia.coolkit.cc
```

**💡 Tips:**
```bash
# Generate random SESSION_SECRET
openssl rand -base64 32

# Generate random password
openssl rand -base64 24
```

### 4.3. Set permissions

```bash
# Secure .env file
chmod 600 .env

# Verify
ls -la .env
```

---

## 5. Chạy Production

### 5.1. Build và start containers

```bash
# Pull latest images
docker-compose pull

# Build production image
docker-compose build --no-cache

# Start production
docker-compose --profile prod up -d

# Check status
docker-compose ps
```

### 5.2. Verify containers running

```bash
# Check all containers
docker ps

# Check logs
docker-compose logs -f app-prod
docker-compose logs -f mysql

# Test health check
curl http://localhost:3000/health
```

### 5.3. Check database migration

```bash
# Check MySQL logs
docker-compose logs mysql | grep -i "ready for connections"

# Access MySQL
docker exec -it cgbas-mysql mysql -u cgbas -p

# Show databases and tables
SHOW DATABASES;
USE cgbas_db;
SHOW TABLES;
EXIT;
```

---

## 6. Setup Nginx Reverse Proxy

### 6.1. Cài Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### 6.2. Tạo Nginx config

```bash
# Tạo config file
sudo nano /etc/nginx/sites-available/cgbas
```

**Paste nội dung sau:**

```nginx
# HTTP configuration
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Logs
    access_log /var/log/nginx/cgbas_access.log;
    error_log /var/log/nginx/cgbas_error.log;

    # Proxy to Docker container
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
```

### 6.3. Enable site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/cgbas /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 6.4. Test

```bash
# Test từ server
curl -I http://localhost

# Test từ bên ngoài
curl -I http://your-domain.com
```

---

## 7. SSL với Let's Encrypt

### 7.1. Cài Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2. Generate SSL certificate

```bash
# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow prompts:
# 1. Enter email
# 2. Agree to terms
# 3. Choose redirect HTTP to HTTPS (option 2)
```

### 7.3. Verify SSL

```bash
# Check certificate
sudo certbot certificates

# Test SSL
curl -I https://your-domain.com
```

### 7.4. Auto renewal

```bash
# Certbot tự động setup renewal, test bằng:
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer
```

---

## 8. Monitoring & Logs

### 8.1. Docker logs

```bash
# View all logs
docker-compose logs -f

# App logs only
docker-compose logs -f app-prod

# MySQL logs
docker-compose logs -f mysql

# Last 100 lines
docker-compose logs --tail=100 app-prod

# Filter by time
docker-compose logs --since 1h app-prod
```

### 8.2. Container stats

```bash
# Real-time stats
docker stats

# Container details
docker inspect cgbas-app-prod

# Health status
docker inspect --format='{{.State.Health.Status}}' cgbas-app-prod
```

### 8.3. Nginx logs

```bash
# Access log
sudo tail -f /var/log/nginx/cgbas_access.log

# Error log
sudo tail -f /var/log/nginx/cgbas_error.log

# Both
sudo tail -f /var/log/nginx/cgbas_*.log
```

### 8.4. System resources

```bash
# Disk usage
df -h

# Memory usage
free -h

# CPU usage
top
# Press 'q' to quit

# Or use htop (prettier)
sudo apt install htop
htop
```

---

## 9. Auto Start on Boot

Docker containers đã được set `restart: always` trong docker-compose.yml, nên sẽ tự động start khi server reboot.

### 9.1. Verify restart policy

```bash
docker inspect cgbas-app-prod | grep -A 3 RestartPolicy
```

### 9.2. Test reboot

```bash
# Reboot server
sudo reboot

# Sau khi reboot, check containers
docker ps

# Check logs
docker-compose logs --tail=50 app-prod
```

---

## 10. Backup & Restore

### 10.1. Backup Database

```bash
# Create backup directory
mkdir -p ~/backups

# Backup MySQL
docker exec cgbas-mysql mysqldump -u cgbas -p${DB_PASS} cgbas_db > ~/backups/cgbas_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip ~/backups/cgbas_*.sql

# Verify
ls -lh ~/backups/
```

### 10.2. Automated backup script

```bash
# Create backup script
nano ~/backup-cgbas.sh
```

**Paste nội dung:**

```bash
#!/bin/bash

# Load environment variables
source /opt/cgbasv2/.env

# Backup directory
BACKUP_DIR="$HOME/backups"
mkdir -p $BACKUP_DIR

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup database
echo "Backing up database..."
docker exec cgbas-mysql mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/cgbas_db_$TIMESTAMP.sql

# Compress
gzip $BACKUP_DIR/cgbas_db_$TIMESTAMP.sql

# Keep only last 7 days
find $BACKUP_DIR -name "cgbas_db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: cgbas_db_$TIMESTAMP.sql.gz"
```

**Setup cron job:**

```bash
# Make executable
chmod +x ~/backup-cgbas.sh

# Add to crontab (daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * /home/cgbas/backup-cgbas.sh >> /home/cgbas/backup.log 2>&1
```

### 10.3. Restore Database

```bash
# Stop app (optional)
docker-compose stop app-prod

# Restore from backup
gunzip < ~/backups/cgbas_db_20260112_020000.sql.gz | docker exec -i cgbas-mysql mysql -u cgbas -p${DB_PASS} cgbas_db

# Restart app
docker-compose start app-prod
```

### 10.4. Backup entire project

```bash
# Stop containers
docker-compose down

# Create tarball
tar -czf ~/backups/cgbasv2_full_$(date +%Y%m%d).tar.gz -C /opt cgbasv2

# Restart
cd /opt/cgbasv2
docker-compose --profile prod up -d
```

---

## 🔧 Maintenance Commands

### Update application

```bash
cd /opt/cgbasv2

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose --profile prod down
docker-compose build --no-cache
docker-compose --profile prod up -d

# Check logs
docker-compose logs -f app-prod
```

### Restart services

```bash
# Restart app only
docker-compose restart app-prod

# Restart all
docker-compose restart

# Full restart (down + up)
docker-compose down && docker-compose --profile prod up -d
```

### Clean up Docker

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes

# View disk usage
docker system df
```

---

## 🚨 Troubleshooting

### Container không start

```bash
# Check logs
docker-compose logs app-prod

# Check container status
docker ps -a

# Inspect container
docker inspect cgbas-app-prod

# Try manual start
docker start cgbas-app-prod
```

### Database connection error

```bash
# Check MySQL health
docker exec cgbas-mysql mysqladmin ping -h localhost

# Check network
docker network inspect cgbasv2_cgbas-network

# Verify credentials
docker exec -it cgbas-mysql mysql -u cgbas -p
```

### Nginx error

```bash
# Test config
sudo nginx -t

# Check error log
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### Out of memory

```bash
# Check memory
free -h

# Check swap
swapon --show

# Add swap if needed (1GB)
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Port already in use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Or stop conflicting service
sudo systemctl stop <service-name>
```

### SSL certificate issues

```bash
# Renew manually
sudo certbot renew

# Check certificate
sudo certbot certificates

# Reinstall if needed
sudo certbot delete --cert-name your-domain.com
sudo certbot --nginx -d your-domain.com
```

---

## 📊 Performance Monitoring

### Install monitoring tools

```bash
# Install htop
sudo apt install htop

# Install netdata (real-time monitoring)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access: http://your-ip:19999
```

### Docker monitoring

```bash
# Install ctop
sudo wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 -O /usr/local/bin/ctop
sudo chmod +x /usr/local/bin/ctop

# Run
ctop
```

---

## 🔐 Security Best Practices

### 1. Change default passwords

```bash
# App admin password (login rồi đổi trong Settings)
# MySQL root password (đã set trong .env)
# SSH password hoặc dùng SSH key
```

### 2. Disable root SSH login

```bash
sudo nano /etc/ssh/sshd_config

# Change:
PermitRootLogin no
PasswordAuthentication no  # Force SSH key

# Restart SSH
sudo systemctl restart sshd
```

### 3. Setup fail2ban

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Enable automatic security updates

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 📝 Quick Reference

```bash
# Start production
docker-compose --profile prod up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# Logs
docker-compose logs -f

# Stats
docker stats

# Update code
git pull && docker-compose build && docker-compose --profile prod up -d

# Backup DB
docker exec cgbas-mysql mysqldump -u cgbas -p cgbas_db > backup.sql

# Restore DB
docker exec -i cgbas-mysql mysql -u cgbas -p cgbas_db < backup.sql
```

---

## 🎉 Hoàn tất!

Sau khi hoàn thành tất cả các bước:

1. ✅ Application running: `https://your-domain.com`
2. ✅ SSL certificate active
3. ✅ Auto-restart on reboot
4. ✅ Daily automated backups
5. ✅ Monitoring enabled
6. ✅ Logs tracked

**Default login:**
- Username: `admin`
- Password: `admin123`

**⚠️ IMPORTANT:** Đổi password ngay sau lần đăng nhập đầu tiên!

---

## 📞 Support

Nếu gặp vấn đề:
1. Check logs: `docker-compose logs -f`
2. Check health: `curl http://localhost:3000/health`
3. Check containers: `docker ps -a`
4. Check Nginx: `sudo nginx -t`
5. Review this guide

Good luck! 🚀
