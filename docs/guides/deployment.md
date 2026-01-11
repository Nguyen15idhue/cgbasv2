# 🚀 Deployment Guide

Hướng dẫn deploy CGBAS v2 lên production server.

---

## Prerequisites

- **OS**: Ubuntu 20.04 LTS hoặc mới hơn
- **RAM**: Tối thiểu 2GB, khuyến nghị 4GB+
- **Disk**: Tối thiểu 20GB
- **Network**: Public IP và domain name

---

## Server Setup

### 1. Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Install Node.js 18+

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify
node -v  # v18.x.x
npm -v   # 9.x.x
```

### 3. Install MySQL 8.0

```bash
# Install MySQL Server
sudo apt install -y mysql-server

# Secure installation
sudo mysql_secure_installation

# Start MySQL
sudo systemctl start mysql
sudo systemctl enable mysql
```

### 4. Install PM2 (Process Manager)

```bash
npm install -g pm2

# Setup PM2 startup
pm2 startup
```

### 5. Install Nginx (Optional but recommended)

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## Application Deployment

### 1. Create Deploy User

```bash
# Create user
sudo adduser cgbas

# Add to sudo group (if needed)
sudo usermod -aG sudo cgbas

# Switch to deploy user
su - cgbas
```

### 2. Clone Repository

```bash
cd /home/cgbas
git clone <your-repository-url> cgbasv2
cd cgbasv2
```

### 3. Install Dependencies

```bash
npm install --production
```

### 4. Configure Environment

```bash
cp .env.example .env
nano .env
```

**Production `.env`:**
```bash
# Database
DB_HOST=localhost
DB_USER=cgbas_user
DB_PASSWORD=<strong-password>
DB_NAME=cgbas_production
DB_PORT=3306

# Server
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# Session (Generate secure secret!)
SESSION_SECRET=<generate-32-char-random-string>

# CGBAS API
API_BASE_URL=https://api.cgbas.com
AK=<your-access-key>
SK=<your-secret-key>

# eWelink API
EWELINK_API=https://eu-apia.coolkit.cc
EWELINK_TOKEN=<your-bearer-token>

# Logging
LOG_LEVEL=warn
```

**Generate Secure Session Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Database Setup

```bash
# Login to MySQL
sudo mysql

# Create database
CREATE DATABASE cgbas_production
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

# Create user
CREATE USER 'cgbas_user'@'localhost' IDENTIFIED BY '<strong-password>';

# Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE 
  ON cgbas_production.* 
  TO 'cgbas_user'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

### 6. Run Migrations

```bash
cd /home/cgbas/cgbasv2
node src/migrations/index.js
```

### 7. Create Default Admin User

```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your_password', 10));"

# Copy hash và insert vào DB
mysql -u cgbas_user -p cgbas_production

INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '<bcrypt-hash>', 'Administrator', 'admin');
```

---

## PM2 Configuration

### 1. Create Ecosystem File

```bash
nano /home/cgbas/cgbasv2/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'cgbas-v2',
    script: 'src/main.js',
    cwd: '/home/cgbas/cgbasv2',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/home/cgbas/cgbasv2/logs/pm2-error.log',
    out_file: '/home/cgbas/cgbasv2/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    max_memory_restart: '500M',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 2. Start Application

```bash
cd /home/cgbas/cgbasv2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup
# Copy and run the command output
```

### 3. Verify Application

```bash
# Check status
pm2 status

# View logs
pm2 logs cgbas-v2

# Monitor
pm2 monit
```

---

## Nginx Configuration

### 1. Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/cgbas
```

```nginx
upstream cgbas_backend {
    least_conn;
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name cgbas.yourdomain.com;

    # Redirect to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;

    # Logs
    access_log /var/log/nginx/cgbas-access.log;
    error_log /var/log/nginx/cgbas-error.log;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

    # Root location
    location / {
        proxy_pass http://cgbas_backend;
        proxy_http_version 1.1;
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

    # API rate limiting
    location /api/auth/login {
        limit_req zone=login_limit burst=3 nodelay;
        proxy_pass http://cgbas_backend;
    }

    # Static files cache
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$ {
        proxy_pass http://cgbas_backend;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### 2. Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/cgbas /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 3. Setup SSL (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d cgbas.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

**Nginx HTTPS Config:**
```nginx
server {
    listen 443 ssl http2;
    server_name cgbas.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/cgbas.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cgbas.yourdomain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # ... rest of config same as HTTP ...
}
```

---

## Firewall Configuration

```bash
# Allow SSH (change port if needed)
sudo ufw allow 22/tcp

# Allow HTTP & HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct access to Node.js
# (Already behind Nginx)

# Enable firewall
sudo ufw enable
sudo ufw status
```

---

## Database Backup

### 1. Manual Backup

```bash
# Full backup
mysqldump -u cgbas_user -p cgbas_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Exclude logs table
mysqldump -u cgbas_user -p cgbas_production \
  --ignore-table=cgbas_production.ewelink_api_logs \
  > backup_core_$(date +%Y%m%d).sql
```

### 2. Automated Backup Script

```bash
nano /home/cgbas/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/cgbas/backups"
DB_NAME="cgbas_production"
DB_USER="cgbas_user"
DB_PASS="<password>"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Compress
gzip $BACKUP_DIR/backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

```bash
chmod +x /home/cgbas/backup.sh
```

### 3. Cron Job

```bash
crontab -e
```

```cron
# Daily backup at 2 AM
0 2 * * * /home/cgbas/backup.sh >> /home/cgbas/backup.log 2>&1

# Weekly cleanup of old API logs (Sunday 3 AM)
0 3 * * 0 mysql -u cgbas_user -p<password> cgbas_production -e "DELETE FROM ewelink_api_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);"
```

---

## Monitoring

### 1. PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Status
pm2 status

# Logs
pm2 logs cgbas-v2 --lines 100

# Metrics
pm2 describe cgbas-v2
```

### 2. System Monitoring

```bash
# Install htop
sudo apt install -y htop

# Monitor processes
htop
```

### 3. Log Monitoring

```bash
# Application logs
tail -f /home/cgbas/cgbasv2/src/logs/app-*.log

# Error logs
tail -f /home/cgbas/cgbasv2/src/logs/error-*.log

# Nginx logs
sudo tail -f /var/log/nginx/cgbas-access.log
sudo tail -f /var/log/nginx/cgbas-error.log

# PM2 logs
pm2 logs cgbas-v2
```

---

## Maintenance

### Update Application

```bash
cd /home/cgbas/cgbasv2

# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Run migrations (if any)
node src/migrations/index.js

# Restart application
pm2 restart cgbas-v2

# Save PM2 state
pm2 save
```

### Restart Services

```bash
# Restart application
pm2 restart cgbas-v2

# Restart Nginx
sudo systemctl restart nginx

# Restart MySQL
sudo systemctl restart mysql
```

### Log Cleanup

```bash
# Clear PM2 logs
pm2 flush

# Rotate application logs (auto by winston)
# Manual cleanup if needed
find /home/cgbas/cgbasv2/src/logs -name "*.log" -mtime +30 -delete
```

---

## Health Checks

### Application Health

```bash
# Check application status
curl http://localhost:3000/api/dashboard/stats

# Expected response
{
  "onlineStations": 120,
  "offlineStations": 5,
  "pendingJobs": 2,
  "recoveredToday": 8
}
```

### Database Health

```bash
mysql -u cgbas_user -p -e "SELECT COUNT(*) FROM cgbas_production.stations;"
```

### Services Status

```bash
# PM2
pm2 status

# Nginx
sudo systemctl status nginx

# MySQL
sudo systemctl status mysql
```

---

## Rollback Procedure

### 1. Database Rollback

```bash
# Restore from backup
mysql -u cgbas_user -p cgbas_production < backup_20260111_020000.sql
```

### 2. Application Rollback

```bash
cd /home/cgbas/cgbasv2

# Checkout previous version
git log --oneline
git checkout <previous-commit-hash>

# Reinstall dependencies
npm install --production

# Restart
pm2 restart cgbas-v2
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs cgbas-v2 --err

# Check port availability
sudo netstat -tlnp | grep 3000

# Check environment variables
pm2 env cgbas-v2
```

### Database Connection Issues

```bash
# Test connection
mysql -u cgbas_user -p -h localhost cgbas_production

# Check MySQL status
sudo systemctl status mysql

# View MySQL logs
sudo tail -f /var/log/mysql/error.log
```

### High Memory Usage

```bash
# Check PM2 memory
pm2 list

# Restart if needed
pm2 restart cgbas-v2

# Adjust PM2 max_memory_restart in ecosystem.config.js
```

---

## Security Checklist

- [ ] Change default SSH port
- [ ] Disable root SSH login
- [ ] Setup fail2ban
- [ ] Configure firewall (ufw)
- [ ] Use strong database passwords
- [ ] Generate secure SESSION_SECRET
- [ ] Enable HTTPS (Let's Encrypt)
- [ ] Setup automated backups
- [ ] Enable MySQL slow query log
- [ ] Configure rate limiting (Nginx)
- [ ] Keep system updated
- [ ] Monitor logs regularly

---

**Related:**
- [Configuration Guide](./configuration.md)
- [Troubleshooting](./troubleshooting.md)
- [Security Best Practices](./security.md)
