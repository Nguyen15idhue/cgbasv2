# Deploy CGBAS trên VPS (An toàn với MySQL có sẵn)

## ✅ Giải pháp: MySQL container riêng trên port 3307

Docker-compose đã được cấu hình để:
- Tạo MySQL container mới **chỉ cho dự án này**
- Bind port `3307` (thay vì `3306`) để **tránh conflict**
- Sử dụng network riêng `cgbas-network`
- **KHÔNG ảnh hưởng** đến MySQL container hiện tại (`mysql-5.7`)

## Kiểm tra trước khi deploy

### 1. Kiểm tra port 3307 có trống không:
```bash
netstat -tulpn | grep 3307
# Hoặc
ss -tulpn | grep 3307
```
Nếu trống (không có output) → OK để tiếp tục

### 2. Kiểm tra port 3001 có trống không:
```bash
netstat -tulpn | grep 3001
```
Nếu bị chiếm, đổi port trong docker-compose.yml:
```yaml
ports:
  - "3002:3000"  # Hoặc port khác
```

### 3. Kiểm tra Docker có sẵn:
```bash
docker --version
docker-compose --version
```

## Cách Deploy

### Bước 1: Upload code lên VPS

**Option A: Git (Khuyến nghị)**
```bash
cd /opt
git clone <repository_url> cgbasv2
cd cgbasv2
```

**Option B: SCP từ local**
```bash
# Từ máy local (Windows)
scp -r c:\laragon\www\cgbasv2 root@<VPS_IP>:/opt/
```

### Bước 2: Cấu hình môi trường

```bash
cd /opt/cgbasv2

# Copy và chỉnh sửa .env
cp .env.example .env
nano .env
```

**Cập nhật trong .env:**
```env
# MySQL - sẽ tự động tạo container mới
DB_HOST=mysql
DB_USER=cgbas
DB_PASS=your_secure_password_here
DB_NAME=cgbas_db

# Session secret - PHẢI đổi trong production
SESSION_SECRET=generate-random-32-chars-min

# API credentials
AK=your_ak
SK=your_sk
API_BASE_URL=http://rtk.taikhoandodac.vn:8090

# Ewelink
EWELINK_APPID=...
EWELINK_APPSECRET=...
EWELINK_TOKEN=...
EWELINK_REFRESHTOKEN=...
```

### Bước 3: Deploy Production

```bash
# Build và start containers
docker-compose --profile prod up -d --build

# Xem logs
docker-compose logs -f app-prod
```

### Bước 4: Kiểm tra

```bash
# Check containers đang chạy
docker ps

# Kết quả mong đợi:
# - mysql-5.7 (MySQL cũ - không đụng vào)
# - cgbas-mysql (MySQL mới - port 3307)
# - cgbas-app-prod (App)

# Test health (từ trong VPS)
curl http://localhost:3001/health

# Hoặc test từ bên ngoài (thay YOUR_VPS_IP)
curl http://YOUR_VPS_IP:3001/health

# Xem logs MySQL mới
docker logs cgbas-mysql

# Kiểm tra database đã tạo
docker exec -it cgbas-mysql mysql -u cgbas -p
# Enter password: your_secure_password_here
# Trong MySQL:
SHOW DATABASES;
USE cgbas_db;
SHOW TABLES;
EXIT;
```

## Firewall - Mở port 3001 trên Ubuntu VPS

### Cách 1: Sử dụng UFW (Khuyến nghị)

```bash
# Kiểm tra UFW đã bật chưa
sudo ufw status

# Nếu chưa bật, bật UFW (CHÚ Ý: mở port SSH trước!)
sudo ufw allow 22/tcp
sudo ufw enable

# Mở port 3001 cho ứng dụng web
sudo ufw allow 3001/tcp

# Kiểm tra lại
sudo ufw status numbered

# Kết quả mong đợi:
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 3001/tcp                   ALLOW       Anywhere
```

### Cách 2: Sử dụng iptables (nếu không dùng UFW)

```bash
# Mở port 3001
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT

# Lưu rules (Ubuntu/Debian)
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# Hoặc (CentOS/RHEL)
sudo service iptables save
```

### Cách 3: Nếu dùng cloud provider (AWS, GCP, Azure)

Ngoài firewall trên VPS, cần mở port trong **Security Group/Network Rules**:
- AWS: EC2 → Security Groups → Edit Inbound Rules → Add Rule (TCP 3001)
- Azure: Network Security Groups → Inbound security rules
- GCP: VPC Firewall Rules → Create Firewall Rule

### Test sau khi mở port

```bash
# Test từ trong VPS
curl http://localhost:3001/health

# Test từ máy local (Windows/Mac)
# Thay YOUR_VPS_IP bằng IP thực của VPS
curl http://YOUR_VPS_IP:3001/health

# Hoặc mở trình duyệt:
# http://YOUR_VPS_IP:3001
```

### Troubleshooting

**Lỗi: Connection refused**
```bash
# Kiểm tra app có đang chạy không
docker ps | grep cgbas-app

# Kiểm tra app đang listen port nào
docker exec cgbas-app-prod netstat -tlnp | grep 3000
```

**Lỗi: Connection timeout**
```bash
# Kiểm tra firewall
sudo ufw status verbose

# Kiểm tra port có open không (từ máy local)
telnet YOUR_VPS_IP 3001
# Hoặc
nc -zv YOUR_VPS_IP 3001
```

**Nếu vẫn không truy cập được:**
- Kiểm tra Security Group của cloud provider
- Kiểm tra Docker container có chạy: `docker logs cgbas-app-prod`
- Kiểm tra port mapping: `docker port cgbas-app-prod`

## Quản lý

### Start/Stop services
```bash
# Stop all
docker-compose --profile prod down

# Start
docker-compose --profile prod up -d

# Restart
docker-compose --profile prod restart

# Xem logs
docker-compose logs -f app-prod
docker-compose logs -f mysql
```

### Backup database
```bash
# Backup
docker exec cgbas-mysql mysqldump -u cgbas -p cgbas_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Nén
gzip backup_*.sql

# Restore (nếu cần)
docker exec -i cgbas-mysql mysql -u cgbas -p cgbas_db < backup.sql
```

### Update code
```bash
cd /opt/cgbasv2
git pull origin main
docker-compose --profile prod up -d --build --force-recreate
```

## Xác nhận KHÔNG ảnh hưởng các dịch vụ khác

### 1. Kiểm tra MySQL cũ vẫn chạy:
```bash
docker ps | grep mysql-5.7
docker exec -it mysql-5.7 mysql -u root -p
```

### 2. Kiểm tra network isolation:
```bash
# MySQL cũ dùng host network
docker inspect mysql-5.7 | grep NetworkMode
# Kết quả: "NetworkMode": "host"

# MySQL mới dùng bridge network riêng
docker inspect cgbas-mysql | grep NetworkMode
# Kết quả: "NetworkMode": "cgbasv2_cgbas-network"
```

### 3. Kiểm tra ports:
```bash
# MySQL cũ: port 3306 (host network)
# MySQL mới: port 3307 → 3306 (bridge network)
docker port cgbas-mysql
# Kết quả: 3306/tcp -> 0.0.0.0:3307
```

## Troubleshooting

### Lỗi: Port 3307 already in use
```bash
# Tìm process đang dùng
sudo lsof -i :3307
# Hoặc đổi port khác trong docker-compose.yml
ports:
  - "3308:3306"
```

### Lỗi: Cannot connect to MySQL
```bash
# Xem logs MySQL
docker logs cgbas-mysql

# Kiểm tra health
docker exec cgbas-mysql mysqladmin ping -h localhost -u root -p

# Kiểm tra từ app container
docker exec -it cgbas-app-prod ping mysql
```

### App không start
```bash
# Xem logs chi tiết
docker-compose logs app-prod

# Kiểm tra tất cả services
docker-compose ps

# Restart clean
docker-compose --profile prod down -v
docker-compose --profile prod up -d --build
```

### MySQL migrations không chạy
```bash
# Chạy thủ công
docker exec -i cgbas-mysql mysql -u root -p cgbas_db < src/migrations/001_create_stations_table.sql

# Hoặc vào MySQL console
docker exec -it cgbas-mysql bash
cd /docker-entrypoint-initdb.d
mysql -u root -p cgbas_db < 001_create_stations_table.sql
```

## Monitoring

```bash
# Resource usage
docker stats cgbas-app-prod cgbas-mysql

# Logs realtime
docker-compose logs -f --tail=100

# Disk usage
docker system df
```

## Cleanup (khi không cần nữa)

```bash
# Stop và xóa containers + volumes
docker-compose --profile prod down -v

# Xóa images (nếu cần)
docker rmi cgbasv2-app-prod cgbasv2-mysql

# Xóa code
rm -rf /opt/cgbasv2
```

## Tóm tắt kiến trúc

```
VPS:
├── mysql-5.7 (container cũ)
│   └── Host Network → Port 3306
│
└── CGBAS Project (containers mới)
    ├── cgbas-mysql (MySQL 8.0)
    │   └── Bridge Network → Port 3307:3306
    │
    └── cgbas-app-prod (Node.js)
        └── Bridge Network → Port 3001:3000
        └── Connects to: mysql:3306 (internal)
```

**Kết luận:** Hoàn toàn an toàn, không ảnh hưởng MySQL cũ! ✅
