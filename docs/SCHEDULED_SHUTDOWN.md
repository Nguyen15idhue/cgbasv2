# TÍNH NĂNG: TẮT/BẬT TRẠM THEO LỊCH HÀNG NGÀY

## Tổng Quan

Tính năng này cho phép tự động tắt tất cả trạm đã ánh xạ eWeLink vào một thời gian cố định mỗi ngày, sau đó tự động bật lại sau x phút.

### Đặc Điểm Chính

- ✅ **Thời gian cố định**: Tất cả trạm tắt vào cùng 1 thời điểm (thay vì ngẫu nhiên)
- ✅ **Xử lý theo batch**: Tắt/bật theo nhóm 5 trạm (tránh vượt rate limit eWeLink)
- ✅ **Theo dõi bằng nhãn**: Sử dụng bảng `scheduled_shutdown_labels` để đánh dấu tiến trình
- ✅ **Lịch sử đầy đủ**: Lưu toàn bộ lịch sử thực hiện hàng ngày
- ✅ **Tự động chạy**: Scheduler kiểm tra mỗi 30 giây

---

## Cấu Trúc Database

### Bảng: `scheduled_shutdown_config`

Lưu cấu hình cho tính năng.

| Cột | Kiểu | Mặc Định | Mô Tả |
|-----|------|----------|-------|
| `id` | INT | 1 | ID cố định (chỉ có 1 bản ghi) |
| `shutdown_time` | TIME | 02:00:00 | Giờ bắt đầu tắt trạm |
| `shutdown_duration_minutes` | INT | 5 | Thời gian tắt (phút) |
| `batch_size` | INT | 5 | Số trạm xử lý mỗi lần |
| `batch_delay_seconds` | INT | 10 | Delay giữa các batch (giây) |
| `is_enabled` | BOOLEAN | TRUE | Bật/tắt tính năng |

### Bảng: `scheduled_shutdown_labels`

Theo dõi trạng thái từng trạm trong quá trình tắt/bật.

| Cột | Kiểu | Mô Tả |
|-----|------|-------|
| `station_id` | VARCHAR(50) | ID trạm |
| `labeled_at` | TIMESTAMP | Thời điểm gắn nhãn |
| `shutdown_completed_at` | TIMESTAMP | Thời điểm hoàn thành tắt |
| `poweron_completed_at` | TIMESTAMP | Thời điểm hoàn thành bật |
| `status` | ENUM | `pending`, `shutting_down`, `waiting_poweron`, `powering_on`, `completed`, `failed` |
| `error_message` | TEXT | Thông báo lỗi (nếu có) |

### Bảng: `scheduled_shutdown_history`

Lưu lịch sử các lần thực hiện.

| Cột | Kiểu | Mô Tả |
|-----|------|-------|
| `id` | INT | ID tự tăng |
| `execution_date` | DATE | Ngày thực hiện |
| `started_at` | TIMESTAMP | Thời điểm bắt đầu |
| `completed_at` | TIMESTAMP | Thời điểm kết thúc |
| `total_stations` | INT | Tổng số trạm |
| `successful_stations` | INT | Số trạm thành công |
| `failed_stations` | INT | Số trạm thất bại |
| `status` | ENUM | `running`, `completed`, `failed` |

---

## Luồng Hoạt Động

```
┌─────────────────────────────────────────────────────────────┐
│  SCHEDULER (Chạy mỗi 30 giây)                               │
│  - Kiểm tra: Đã đến giờ chưa? (±30s tolerance)              │
│  - Kiểm tra: Hôm nay đã chạy chưa?                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Đến giờ & Chưa chạy   │
        └────────────┬───────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 1: GẮN NHÃN                                           │
│  - Xóa nhãn cũ (nếu có)                                     │
│  - Lấy tất cả trạm có ewelink_device_id & is_active=1      │
│  - Gắn nhãn 'pending' cho tất cả                           │
│  - Tạo bản ghi lịch sử                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 2: TẮT TRẠM (THEO BATCH)                              │
│                                                             │
│  While (Còn trạm có status='pending'):                      │
│    1. Lấy batch_size trạm                                  │
│    2. Gọi eWeLink API tắt từng trạm                        │
│    3. Cập nhật status → 'waiting_poweron'                  │
│    4. Delay batch_delay_seconds giây                       │
│                                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 3: CHỜ                                                │
│  - Sleep shutdown_duration_minutes phút                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  BƯỚC 4: BẬT TRẠM (THEO BATCH)                              │
│                                                             │
│  While (Còn trạm có status='waiting_poweron'):              │
│    1. Lấy batch_size trạm                                  │
│    2. Gọi eWeLink API bật từng trạm                        │
│    3. Cập nhật status → 'completed'                        │
│    4. Delay batch_delay_seconds giây                       │
│                                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  KẾT THÚC                                                   │
│  - Cập nhật lịch sử: total, success, failed                │
│  - Trạng thái: 'completed'                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Lấy Cấu Hình

```http
GET /api/scheduled-shutdown/config
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "shutdown_time": "02:00:00",
    "shutdown_duration_minutes": 5,
    "batch_size": 5,
    "batch_delay_seconds": 10,
    "is_enabled": true
  }
}
```

### 2. Cập Nhật Cấu Hình

```http
PUT /api/scheduled-shutdown/config
Content-Type: application/json

{
  "shutdown_time": "03:00:00",
  "shutdown_duration_minutes": 10,
  "batch_size": 5,
  "batch_delay_seconds": 10,
  "is_enabled": true
}
```

**Validation:**
- `shutdown_time`: Định dạng HH:MM:SS
- `shutdown_duration_minutes`: 1-60 phút
- `batch_size`: 1-20 trạm
- `batch_delay_seconds`: 5-60 giây

### 3. Lấy Trạng Thái Hiện Tại

```http
GET /api/scheduled-shutdown/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "config": {...},
    "is_running": false,
    "current_execution_id": null,
    "label_statistics": [
      { "status": "pending", "count": 10 },
      { "status": "completed", "count": 5 }
    ],
    "recent_history": [...]
  }
}
```

### 4. Thực Thi Thủ Công (Test)

```http
POST /api/scheduled-shutdown/execute
```

**Response:**
```json
{
  "success": true,
  "message": "Đã bắt đầu quy trình tắt/bật trạm"
}
```

---

## Cấu Hình

### Thay Đổi Thời Gian Tắt

Mặc định: **02:00:00** (2 giờ sáng)

**Option 1: Qua API**
```bash
curl -X PUT http://localhost:3001/api/scheduled-shutdown/config \
  -H "Content-Type: application/json" \
  -d '{
    "shutdown_time": "03:30:00",
    "shutdown_duration_minutes": 5,
    "batch_size": 5,
    "batch_delay_seconds": 10,
    "is_enabled": true
  }'
```

**Option 2: Qua Database**
```sql
UPDATE scheduled_shutdown_config 
SET shutdown_time = '03:30:00' 
WHERE id = 1;
```

### Thay Đổi Batch Size

Nếu eWeLink cho phép nhiều request hơn, tăng `batch_size`:

```sql
UPDATE scheduled_shutdown_config 
SET batch_size = 10 
WHERE id = 1;
```

### Tắt Tính Năng

```sql
UPDATE scheduled_shutdown_config 
SET is_enabled = FALSE 
WHERE id = 1;
```

---

## Logs & Monitoring

### Xem Logs Real-time

```bash
# Docker
docker logs -f cgbas-app --tail 100

# Local
tail -f src/logs/app.log
```

### Ví Dụ Logs

```
[ScheduledShutdown] ========== BẮT ĐẦU QUY TRÌNH TẮT/BẬT TRẠM ==========
[ScheduledShutdown] BƯỚC 1: Gắn nhãn cho tất cả trạm...
[ScheduledShutdown] ✓ Đã gắn nhãn cho 42 trạm
[ScheduledShutdown] BƯỚC 2: Tắt 42 trạm (batch size: 5)...
[ScheduledShutdown] Xử lý batch: 5 trạm...
[ScheduledShutdown] Tắt trạm 001 (Device: 1000abc123)...
[ScheduledShutdown] ✓ Đã tắt trạm 001
[ScheduledShutdown] Chờ 10s trước batch tiếp...
[ScheduledShutdown] ✓ Hoàn thành tắt: 42 thành công, 0 thất bại
[ScheduledShutdown] BƯỚC 3: Chờ 5 phút trước khi bật lại...
[ScheduledShutdown] BƯỚC 4: Bật lại trạm...
[ScheduledShutdown] ========== KẾT THÚC QUY TRÌNH ==========
[ScheduledShutdown] Tổng: 42 | Thành công: 42 | Thất bại: 0
```

### Query Lịch Sử

```sql
-- Lịch sử 7 ngày gần nhất
SELECT 
    execution_date,
    total_stations,
    successful_stations,
    failed_stations,
    TIMESTAMPDIFF(MINUTE, started_at, completed_at) as duration_minutes,
    status
FROM scheduled_shutdown_history
ORDER BY execution_date DESC
LIMIT 7;
```

### Kiểm Tra Trạm Lỗi

```sql
-- Trạm bị lỗi trong lần shutdown gần nhất
SELECT 
    sl.station_id,
    s.stationName,
    sl.status,
    sl.error_message
FROM scheduled_shutdown_labels sl
JOIN stations s ON sl.station_id = s.id
WHERE sl.status = 'failed'
ORDER BY sl.labeled_at DESC;
```

---

## Troubleshooting

### Tính năng không chạy

1. **Kiểm tra cấu hình:**
   ```sql
   SELECT * FROM scheduled_shutdown_config;
   ```
   Đảm bảo `is_enabled = 1`

2. **Kiểm tra scheduler:**
   - Xem logs khi khởi động: `🚀 Scheduler: ... | 30s (Scheduled Shutdown Check)`
   - Nếu không thấy → Service chưa khởi động đúng

3. **Kiểm tra thời gian hệ thống:**
   ```bash
   date
   ```
   Đảm bảo timezone đúng

### Trạm không tắt

1. **Kiểm tra mapping eWeLink:**
   ```sql
   SELECT id, stationName, ewelink_device_id, is_active 
   FROM stations 
   WHERE ewelink_device_id IS NOT NULL;
   ```

2. **Kiểm tra eWeLink token:**
   - Vào `/configs` để cập nhật token nếu hết hạn

3. **Xem logs lỗi:**
   ```sql
   SELECT * FROM scheduled_shutdown_labels WHERE status = 'failed';
   ```

### Batch quá chậm

- Giảm `batch_delay_seconds` (tối thiểu 5s):
  ```sql
  UPDATE scheduled_shutdown_config SET batch_delay_seconds = 5 WHERE id = 1;
  ```

- Tăng `batch_size` (nếu eWeLink cho phép):
  ```sql
  UPDATE scheduled_shutdown_config SET batch_size = 10 WHERE id = 1;
  ```

---

## Lưu Ý Quan Trọng

### 🔴 Xung Đột với Recovery System

Tính năng này **độc lập** với hệ thống `auto-recovery`:

- **Scheduled Shutdown**: Tắt/bật có kế hoạch hàng ngày
- **Auto Recovery**: Xử lý sự cố mất điện/offline bất thường

Khi một trạm đang trong quá trình scheduled shutdown:
- Recovery system có thể phát hiện trạm offline
- **KHÔNG nên** tạo recovery job cho trạm này

**Giải pháp:**
- Recovery system đã có logic kiểm tra trạm online/offline tự nhiên
- Chỉ tắt trong 5-10 phút nên ảnh hưởng không đáng kể

### 🔴 Rate Limit eWeLink

eWeLink có giới hạn request:
- **Mặc định**: 5 trạm/batch, delay 10s
- **Nếu bị lỗi 429 (Too Many Requests)**: Giảm batch_size hoặc tăng delay

### 🔴 Thời Gian Tắt

Không nên tắt quá lâu:
- **Khuyến nghị**: 5-10 phút
- **Tối đa**: 60 phút

---

## Ví Dụ Sử Dụng

### Kịch Bản 1: Tắt vào 2 giờ sáng, 5 phút

```sql
UPDATE scheduled_shutdown_config SET
    shutdown_time = '02:00:00',
    shutdown_duration_minutes = 5,
    batch_size = 5,
    batch_delay_seconds = 10,
    is_enabled = TRUE
WHERE id = 1;
```

### Kịch Bản 2: Tắt vào 3 giờ sáng, 10 phút, batch lớn hơn

```sql
UPDATE scheduled_shutdown_config SET
    shutdown_time = '03:00:00',
    shutdown_duration_minutes = 10,
    batch_size = 10,
    batch_delay_seconds = 5,
    is_enabled = TRUE
WHERE id = 1;
```

### Test Thủ Công

```bash
# Test qua API
curl -X POST http://localhost:3001/api/scheduled-shutdown/execute \
  -H "Cookie: cgbas_session=<your-session-cookie>"
```

---

## Tóm Tắt

✅ **Tự động**: Chạy hàng ngày vào giờ cố định
✅ **An toàn**: Xử lý theo batch, tránh rate limit
✅ **Theo dõi**: Nhãn + lịch sử đầy đủ
✅ **Linh hoạt**: Dễ dàng cấu hình qua API hoặc Database

🎯 **Mục đích**: Thống nhất thời gian bảo trì/reset trạm hàng ngày thay vì để ngẫu nhiên.
