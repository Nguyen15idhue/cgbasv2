# 📋 Quick Reference

## Development
```bash
# Windows
docker-start.bat

# Linux/Mac
./docker-start.sh
```

## Manual Commands

### Development
```bash
docker-compose --profile dev up -d
docker-compose logs -f app-dev
```

### Production
```bash
docker-compose --profile prod up -d --build
docker-compose logs -f app-prod
```

### Stop
```bash
docker-compose down
```

## Access
- App: http://localhost:3000
- Login: admin / admin123

## Monitoring
```bash
docker stats
docker-compose ps
```

Xem DOCKER_GUIDE.md để biết thêm chi tiết!
