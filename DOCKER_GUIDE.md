# 🐳 Docker Deployment Guide

## 📦 Tính năng

- ✅ **Multi-stage build** - Image production cực nhẹ (~150MB)
- ✅ **Alpine Linux** - Base image nhỏ nhất, tiêu thụ ít CPU/RAM
- ✅ **Non-root user** - Bảo mật cao cho production
- ✅ **Health check** - Tự động kiểm tra và restart nếu lỗi
- ✅ **Signal handling** - Graceful shutdown với tini/dumb-init
- ✅ **MySQL included** - Database tự động setup
- ✅ **Volume persistence** - Data không bị mất khi restart

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

### App không start được
```bash
# Check logs
docker-compose logs app-prod

# Check health
docker inspect cgbas-app-prod

# Restart
docker-compose restart app-prod
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

### Local Development
```bash
docker-compose --profile dev up -d
```

### Production Server
```bash
docker-compose --profile prod up -d --build
```

### Both (Testing)
```bash
docker-compose --profile dev --profile prod up -d
```

## 📞 Support

Nếu gặp vấn đề, check:
1. Docker logs: `docker-compose logs -f`
2. Container status: `docker-compose ps`
3. Resource usage: `docker stats`
4. Network: `docker network inspect cgbasv2_cgbas-network`
