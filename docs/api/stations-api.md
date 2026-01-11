# 🗼 Stations API

API quản lý trạm RTK và phục hồi tự động.

---

## Base URL

```
http://localhost:3000/api/stations
```

**Authentication Required**: Tất cả endpoints yêu cầu session hợp lệ.

---

## 1. Lấy danh sách trạm

### `GET /list`

Lấy danh sách tất cả trạm với thông tin đầy đủ.

#### Request

```http
GET /api/stations/list
Cookie: cgbas_session=<session-id>
```

#### Response (200)

```json
{
  "success": true,
  "total": 150,
  "stations": [
    {
      "id": "STA001",
      "stationName": "Trạm RTK Hà Nội",
      "identificationName": "HN-RTK-01",
      "stationType": "CORS",
      "lat": 21.0285,
      "lng": 105.8542,
      "ewelink_device_id": "1000abc123",
      "connectStatus": 1,
      "delay": 45,
      "sat_R": 12,
      "sat_C": 8,
      "sat_E": 10,
      "sat_G": 15,
      "lastUpdate": "2026-01-11T10:30:00.000Z"
    }
  ]
}
```

#### Connect Status Values

| Value | Status | Màu hiển thị |
|-------|--------|--------------|
| 0 | Chưa kết nối | Gray |
| 1 | Online | Green |
| 2 | Chưa định vị | Yellow |
| 3 | Offline | Red |

---

## 2. Lấy trạng thái trạm (Legacy)

### `GET /status`

API tương thích ngược, trả về cấu trúc cũ.

#### Request

```http
GET /api/stations/status
Cookie: cgbas_session=<session-id>
```

#### Response (200)

```json
{
  "success": true,
  "total": 150,
  "data": [
    {
      "id": "STA001",
      "stationName": "Trạm RTK Hà Nội",
      "connectStatus": 1,
      "delay": 45,
      "sat_R": 12,
      "sat_C": 8,
      "sat_E": 10,
      "sat_G": 15,
      "lastDynamicUpdate": "2026-01-11T10:30:00.000Z"
    }
  ]
}
```

---

## 3. Kích hoạt phục hồi trạm

### `POST /recover`

Tạo job phục hồi tự động cho trạm offline.

#### Request

```http
POST /api/stations/recover
Content-Type: application/json
Cookie: cgbas_session=<session-id>

{
  "stationId": "STA001",
  "deviceId": "1000abc123"
}
```

#### Response - Success (200)

```json
{
  "success": true,
  "message": "Đã thêm vào hàng đợi phục hồi"
}
```

#### Response - Already Exists (400)

```json
{
  "success": false,
  "message": "Trạm này đã có trong hàng đợi phục hồi"
}
```

#### Response - Missing Fields (400)

```json
{
  "success": false,
  "message": "Thiếu thông tin stationId hoặc deviceId"
}
```

---

## 4. Cập nhật ánh xạ thiết bị

### `POST /update-mapping`

Liên kết trạm CGBAS với thiết bị eWelink.

#### Request

```http
POST /api/stations/update-mapping
Content-Type: application/json
Cookie: cgbas_session=<session-id>

{
  "stationId": "STA001",
  "deviceId": "1000abc123"
}
```

#### Response - Success (200)

```json
{
  "success": true,
  "message": "Đã cập nhật ánh xạ thiết bị thành công"
}
```

---

## 5. Lấy lịch sử phục hồi

### `GET /recovery-history`

Xem lịch sử các lần phục hồi trạm.

#### Request

```http
GET /api/stations/recovery-history?stationId=STA001&status=SUCCESS&limit=20&offset=0
Cookie: cgbas_session=<session-id>
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| stationId | string | No | - | Lọc theo ID trạm |
| status | string | No | - | Lọc theo trạng thái (SUCCESS/FAILED) |
| limit | integer | No | 50 | Số bản ghi trả về |
| offset | integer | No | 0 | Vị trí bắt đầu |

#### Response (200)

```json
{
  "success": true,
  "total": 245,
  "data": [
    {
      "id": 1,
      "station_id": "STA001",
      "stationName": "Trạm RTK Hà Nội",
      "identificationName": "HN-RTK-01",
      "device_id": "1000abc123",
      "status": "SUCCESS",
      "retry_count": 2,
      "total_duration_minutes": 12,
      "failure_reason": null,
      "started_at": "2026-01-11T08:00:00.000Z",
      "completed_at": "2026-01-11T08:12:00.000Z"
    },
    {
      "id": 2,
      "station_id": "STA001",
      "stationName": "Trạm RTK Hà Nội",
      "identificationName": "HN-RTK-01",
      "device_id": "1000abc123",
      "status": "FAILED",
      "retry_count": 6,
      "total_duration_minutes": 122,
      "failure_reason": "Trạm không có tín hiệu sau điều khiển",
      "started_at": "2026-01-10T14:00:00.000Z",
      "completed_at": "2026-01-10T16:02:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## 6. Thống kê phục hồi

### `GET /recovery-stats`

Lấy thống kê tổng quan về phục hồi trạm.

#### Request

```http
GET /api/stations/recovery-stats
Cookie: cgbas_session=<session-id>
```

#### Response (200)

```json
{
  "success": true,
  "summary": {
    "total_attempts": 245,
    "success_count": 198,
    "failed_count": 47,
    "avg_success_duration": 15.5,
    "avg_retry_count": 1.8
  },
  "topOfflineStations": [
    {
      "station_id": "STA001",
      "stationName": "Trạm RTK Hà Nội",
      "identificationName": "HN-RTK-01",
      "offline_count": 45,
      "success_count": 38,
      "failed_count": 7
    }
  ],
  "weeklyTrend": [
    {
      "date": "2026-01-11",
      "total": 12,
      "success": 10,
      "failed": 2
    },
    {
      "date": "2026-01-10",
      "total": 15,
      "success": 13,
      "failed": 2
    }
  ]
}
```

---

## Examples

### JavaScript (Fetch)

```javascript
// Lấy danh sách trạm
async function getStations() {
  const response = await fetch('http://localhost:3000/api/stations/list', {
    credentials: 'include'
  });
  return await response.json();
}

// Kích hoạt phục hồi
async function recoverStation(stationId, deviceId) {
  const response = await fetch('http://localhost:3000/api/stations/recover', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ stationId, deviceId })
  });
  return await response.json();
}

// Xem lịch sử
async function getRecoveryHistory(stationId, limit = 20) {
  const url = new URL('http://localhost:3000/api/stations/recovery-history');
  if (stationId) url.searchParams.set('stationId', stationId);
  url.searchParams.set('limit', limit);
  
  const response = await fetch(url, {
    credentials: 'include'
  });
  return await response.json();
}
```

### cURL

```bash
# Lấy danh sách trạm
curl http://localhost:3000/api/stations/list \
  -b cookies.txt

# Kích hoạt phục hồi
curl -X POST http://localhost:3000/api/stations/recover \
  -H "Content-Type: application/json" \
  -d '{"stationId":"STA001","deviceId":"1000abc123"}' \
  -b cookies.txt

# Xem lịch sử
curl "http://localhost:3000/api/stations/recovery-history?stationId=STA001&limit=10" \
  -b cookies.txt

# Thống kê
curl http://localhost:3000/api/stations/recovery-stats \
  -b cookies.txt
```

---

## Auto-Recovery Flow

```
Trạm Offline
    ↓
Monitor phát hiện (15s/lần)
    ↓
Tạo recovery job (PENDING)
    ↓
Scheduler chạy job
    ↓
Kiểm tra thiết bị eWelink online
    ↓
Thực hiện kịch bản (Bật nguồn → Kích nút → Nhả)
    ↓
Đợi 2 phút kiểm tra CGBAS
    ↓
SUCCESS → Lưu history → Xóa job
FAILED → Reschedule (2,5,10,15,30,60 phút)
    ↓
Sau 6 lần → Đánh dấu FAILED → Lưu history
```

---

**Related:**
- [Recovery API Details](./recovery-api.md)
- [eWelink API](./ewelink-api.md)
- [Recovery Mechanism](../architecture/recovery-mechanism.md)
