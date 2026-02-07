# 🔑 Cập nhật eWeLink Token lên VPS

## ✨ Bước 1: Cập nhật token mới vào .env local

```bash
# Mở file .env và sửa 2 dòng:
EWELINK_TOKEN=<token-mới-ở-đây>
EWELINK_REFRESHTOKEN=<refresh-token-mới-ở-đây>
```

## 📤 Bước 2: Push code lên Git

```bash
# QUAN TRỌNG: Không push file .env lên git!
# Chỉ push file .env.example (nếu có thay đổi cấu trúc)

git add .
git commit -m "Update ewelink service"
git push origin main
```

## 🚀 Bước 3: Cập nhật lên VPS

### Cách 1: Sửa trực tiếp trên VPS (Nhanh nhất - Khuyến nghị)

```bash
# SSH vào VPS
ssh root@your-vps-ip

# Vào thư mục project
cd /opt/cgbasv2

# Sửa file .env bằng nano
nano .env

# Tìm và sửa 2 dòng:
EWELINK_TOKEN=<token-mới-ở-đây>
EWELINK_REFRESHTOKEN=<refresh-token-mới-ở-đây>

# Lưu: Ctrl+O, Enter, Ctrl+X

# Restart container để load .env mới
docker-compose --profile prod restart app-prod

# Xem logs kiểm tra
docker logs -f cgbas-app-prod
```

### Cách 2: Dùng script update-vps.sh (Nếu đã sửa .env trên VPS)

```bash
cd /opt/cgbasv2

# Sau khi đã sửa .env, chỉ cần restart
docker-compose --profile prod restart app-prod

# Hoặc dùng script (nó sẽ pull code + rebuild)
./update-vps.sh
```

## ✅ Bước 4: Kiểm tra sau khi restart

```bash
# 1. Check container đã restart chưa
docker ps | grep cgbas-app-prod

# 2. Check logs có lỗi token không
docker logs --tail=50 cgbas-app-prod | grep -i token

# 3. Test điều khiển thiết bị qua web
# Vào trang Devices và thử bật/tắt 1 thiết bị

# 4. Xem api logs
docker exec cgbas-app-prod sh -c "tail -20 logs/app.log"
```

## 🎯 TÓM TẮT - Quy trình nhanh:

```bash
# 1. SSH vào VPS
ssh root@your-vps-ip

# 2. Sửa .env
cd /opt/cgbasv2
nano .env
# (Sửa EWELINK_TOKEN và EWELINK_REFRESHTOKEN)

# 3. Restart container
docker-compose --profile prod restart app-prod

# 4. Xem logs
docker logs -f cgbas-app-prod
```

## ⚡ Lưu ý quan trọng:

- ✅ **RESTART là đủ** - Không cần rebuild nếu chỉ sửa .env
- ✅ **Không push .env lên git** - Token là thông tin bảo mật
- ✅ **Restart nhanh** - Chỉ mất 2-3 giây
- ⚠️ **Nếu rebuild**: Container sẽ mất 1-2 phút và tạo lại từ đầu
- ⚠️ **Nếu down + up**: Tương tự rebuild, mất thời gian hơn

## 🔄 Lệnh Docker liên quan:

```bash
# Restart (nhanh nhất - khuyến nghị)
docker-compose --profile prod restart app-prod

# Stop và Start (nếu restart không work)
docker-compose --profile prod stop app-prod
docker-compose --profile prod start app-prod

# Down và Up (chỉ khi cần)
docker-compose --profile prod down
docker-compose --profile prod up -d

# Rebuild (chỉ khi thay đổi code hoặc Dockerfile)
docker-compose build --no-cache app-prod
docker-compose --profile prod up -d
```

## 🆘 Lệnh hữu ích khác:

```bash
# Xem biến môi trường trong container
docker exec cgbas-app-prod printenv | grep EWELINK

# Copy file .env từ local lên VPS (nếu cần)
scp .env root@your-vps-ip:/opt/cgbasv2/.env

# Backup .env trước khi sửa
cp .env .env.backup
```

---

## 🧪 Chạy file test trên VPS

### Cách 1: Chạy trong Docker container (Khuyến nghị)

```bash
# SSH vào VPS
ssh root@your-vps-ip

# Copy file test vào container
cd /opt/cgbasv2
docker cp test-ewelink.js cgbas-app-prod:/app/test-ewelink.js

# Chạy test trong container
docker exec -it cgbas-app-prod node test-ewelink.js

# Hoặc chỉ refresh token
docker exec -it cgbas-app-prod node test-ewelink.js refresh

# Hoặc test điều khiển thiết bị cụ thể
docker exec -it cgbas-app-prod node test-ewelink.js control 1000abc123 0 on
```

### Cách 2: Push file test lên Git và pull về VPS

```bash
# Local: Push file test lên git
git add test-ewelink.js
git commit -m "Add ewelink test script"
git push origin main

# VPS: Pull code mới
cd /opt/cgbasv2
git pull origin main

# Copy vào container
docker cp test-ewelink.js cgbas-app-prod:/app/test-ewelink.js

# Chạy test
docker exec -it cgbas-app-prod node test-ewelink.js
```

### Cách 3: Chạy trực tiếp trên VPS host (không qua Docker)

```bash
# SSH vào VPS
ssh root@your-vps-ip

# Copy file từ project folder
cd /opt/cgbasv2
cp test-ewelink.js ~/test-ewelink.js
cd ~

# Cài Node.js nếu chưa có
# apt update && apt install -y nodejs npm

# Cài dependencies
npm install axios dotenv

# Copy file .env
cp /opt/cgbasv2/.env .env

# Chạy test
node test-ewelink.js
```

### Lệnh hữu ích:

```bash
# Xem output đầy đủ với màu sắc
docker exec -it cgbas-app-prod node test-ewelink.js | cat

# Lưu output vào file
docker exec cgbas-app-prod node test-ewelink.js > test-result.txt

# Chạy và theo dõi logs realtime
docker exec -it cgbas-app-prod sh -c "node test-ewelink.js && tail -f logs/app.log"
```

---

**Thời gian:** Restart container chỉ mất 2-3 giây! ⚡
