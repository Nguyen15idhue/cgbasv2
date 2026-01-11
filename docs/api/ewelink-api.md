# ⚡ eWelink API

API điều khiển thiết bị IoT eWelink (SONOFF).

---

## Base URL

```
http://localhost:3000/api/ewelink
```

**Authentication Required**: Tất cả endpoints yêu cầu session hợp lệ.

---

## 1. Lấy danh sách thiết bị

### `GET /devices`

Lấy danh sách tất cả thiết bị eWelink từ database.

#### Request

```http
GET /api/ewelink/devices
Cookie: cgbas_session=<session-id>
```

#### Response (200)

```json
{
  "success": true,
  "total": 25,
  "data": [
    {
      "deviceid": "1000abc123",
      "name": "SONOFF 4CH R3 - Trạm HN01",
      "online": true,
      "model": "PSF-B85-GL",
      "brandName": "SONOFF",
      "switch_0": "on",
      "switch_1": "off",
      "voltage_0": "220.5",
      "lastStatusUpdate": "2026-01-11T10:35:00.000Z"
    }
  ]
}
```

#### Device Fields

| Field | Type | Description |
|-------|------|-------------|
| deviceid | string | ID thiết bị duy nhất |
| name | string | Tên thiết bị |
| online | boolean | Trạng thái kết nối |
| model | string | Model thiết bị |
| brandName | string | Thương hiệu (SONOFF, etc.) |
| switch_0 | string | Trạng thái kênh 1 (on/off) |
| switch_1 | string | Trạng thái kênh 2 (on/off) |
| voltage_0 | string | Điện áp kênh 1 (V) |
| lastStatusUpdate | datetime | Lần cập nhật cuối |

---

## 2. Điều khiển kênh đơn

### `POST /control`

Bật/tắt từng kênh của thiết bị.

#### Request

```http
POST /api/ewelink/control
Content-Type: application/json
Cookie: cgbas_session=<session-id>

{
  "deviceid": "1000abc123",
  "channel": "1",
  "action": "on"
}
```

#### Request Fields

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| deviceid | string | Yes | - | ID thiết bị |
| channel | string | Yes | "1", "2" | Số kênh (1=switch_0, 2=switch_1) |
| action | string | Yes | "on", "off" | Hành động |

#### Response - Success (200)

```json
{
  "success": true,
  "message": "Kênh 1 đã chuyển sang on"
}
```

#### Response - Error from eWelink (400)

```json
{
  "success": false,
  "message": "Device is offline"
}
```

#### Response - Missing Fields (400)

```json
{
  "success": false,
  "message": "Thiếu thông tin điều khiển"
}
```

---

## 3. Bật trạm (Full kịch bản)

### `POST /station-on`

Thực hiện kịch bản đầy đủ để bật trạm RTK (có retry 5 lần).

#### Request

```http
POST /api/ewelink/station-on
Content-Type: application/json
Cookie: cgbas_session=<session-id>

{
  "deviceid": "1000abc123"
}
```

#### Kịch bản thực hiện

```
1. Bật Kênh 1 (Nguồn) → Retry 5 lần nếu fail
2. Đợi 10 giây
3. Bật Kênh 2 (Nút) → Retry 5 lần
4. Đợi 5 giây (giữ nút)
5. Tắt Kênh 2 (Nhả nút) → Retry 5 lần
```

#### Response - Success (200)

```json
{
  "success": true,
  "message": "Đã thực hiện kịch bản BẬT trạm thành công"
}
```

#### Response - Failed (500)

```json
{
  "success": false,
  "message": "Không thể thực hiện kịch bản sau 5 lần thử. Chi tiết: Device offline"
}
```

---

## 4. Tắt trạm (Full kịch bản)

### `POST /station-off`

Thực hiện kịch bản đầy đủ để tắt trạm RTK.

#### Request

```http
POST /api/ewelink/station-off
Content-Type: application/json
Cookie: cgbas_session=<session-id>

{
  "deviceid": "1000abc123"
}
```

#### Kịch bản thực hiện

```
1. Bật Kênh 2 (Nút) → Retry 5 lần
2. Đợi 5 giây (giữ nút tắt)
3. Tắt Kênh 2 (Nhả nút) → Retry 5 lần
4. Đợi 10 giây
5. Tắt Kênh 1 (Nguồn) → Retry 5 lần
```

#### Response - Success (200)

```json
{
  "success": true,
  "message": "Đã thực hiện kịch bản TẮT trạm thành công"
}
```

---

## 5. Thống kê API usage

### `GET /api-stats`

Xem thống kê việc sử dụng eWelink API.

#### Request

```http
GET /api/ewelink/api-stats
Cookie: cgbas_session=<session-id>
```

#### Response (200)

```json
{
  "success": true,
  "summary": {
    "total_calls": 1543,
    "daily_stats": [
      {
        "date": "2026-01-11",
        "count": 234
      },
      {
        "date": "2026-01-10",
        "count": 198
      }
    ]
  },
  "history": [
    {
      "id": 1543,
      "method": "POST",
      "endpoint": "/v2/device/thing/switch",
      "payload": "{\"deviceid\":\"1000abc123\",\"params\":{\"switches\":[{\"outlet\":0,\"switch\":\"on\"}]}}",
      "response_code": 200,
      "response_body": "{\"error\":0,\"msg\":\"success\"}",
      "duration_ms": 245,
      "created_at": "2026-01-11T10:30:15.000Z"
    }
  ]
}
```

---

## Retry Mechanism

### Step-Retry (Nội bộ)

Mỗi lệnh điều khiển được thử lại tối đa **5 lần**:

```javascript
// helper.js
async function retryAction(actionFn, label, maxRetries = 5) {
    for (let i = 1; i <= maxRetries; i++) {
        try {
            const result = await actionFn();
            if (result && result.error === 0) {
                return true; // Thành công
            }
        } catch (error) {
            if (i === maxRetries) return false;
            await sleep(2000); // Đợi 2 giây
        }
    }
}
```

**Tổng thời gian tối đa mỗi bước**: 5 lần × 2 giây = **10 giây**

---

## API Logging

Tất cả requests đến eWelink được log tự động:

### Logged Fields

- **method**: HTTP method (GET/POST)
- **endpoint**: eWelink API endpoint
- **payload**: Request body
- **response_code**: HTTP status code
- **response_body**: Response data
- **duration_ms**: Thời gian xử lý (milliseconds)
- **created_at**: Thời điểm gọi API

### Log Interceptors

```javascript
// ewelinkService.js
ewelinkApi.interceptors.request.use(request => {
    request.metadata = { startTime: new Date() };
    return request;
});

ewelinkApi.interceptors.response.use(
    async (response) => {
        await logApiCall(response);
        return response;
    },
    async (error) => {
        await logApiCall(error.response || error);
        return Promise.reject(error);
    }
);
```

---

## Examples

### JavaScript (Fetch)

```javascript
// Điều khiển kênh đơn
async function controlChannel(deviceid, channel, action) {
  const response = await fetch('http://localhost:3000/api/ewelink/control', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ deviceid, channel, action })
  });
  return await response.json();
}

// Bật trạm (Full)
async function turnStationOn(deviceid) {
  const response = await fetch('http://localhost:3000/api/ewelink/station-on', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ deviceid })
  });
  return await response.json();
}

// Tắt trạm (Full)
async function turnStationOff(deviceid) {
  const response = await fetch('http://localhost:3000/api/ewelink/station-off', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ deviceid })
  });
  return await response.json();
}
```

### cURL

```bash
# Điều khiển kênh
curl -X POST http://localhost:3000/api/ewelink/control \
  -H "Content-Type: application/json" \
  -d '{"deviceid":"1000abc123","channel":"1","action":"on"}' \
  -b cookies.txt

# Bật trạm
curl -X POST http://localhost:3000/api/ewelink/station-on \
  -H "Content-Type: application/json" \
  -d '{"deviceid":"1000abc123"}' \
  -b cookies.txt

# Thống kê
curl http://localhost:3000/api/ewelink/api-stats \
  -b cookies.txt
```

---

## eWelink Cloud API

### Base Configuration

```javascript
const ewelinkApi = axios.create({
    baseURL: process.env.EWELINK_API,
    headers: {
        'Authorization': `Bearer ${process.env.EWELINK_TOKEN}`,
        'Content-Type': 'application/json'
    }
});
```

### Environment Variables

```bash
EWELINK_API=https://eu-apia.coolkit.cc
EWELINK_TOKEN=your_bearer_token
```

### Rate Limits

- **Không giới hạn chính thức** nhưng nên tránh spam
- Hệ thống tự retry với delay để tránh bị rate limit
- Adaptive retry: `[2, 5, 10, 15, 30, 60]` phút

---

## Device Models

### SONOFF 4CH R3

- **4 kênh relay** độc lập
- **Voltage sensing** trên kênh 1
- **API endpoint**: `/v2/device/thing/switch`

### Switch Mapping

```javascript
{
  "switches": [
    {"outlet": 0, "switch": "on/off"},  // Kênh 1 (Nguồn trạm)
    {"outlet": 1, "switch": "on/off"},  // Kênh 2 (Nút bấm)
    {"outlet": 2, "switch": "on/off"},  // Kênh 3 (Dự phòng)
    {"outlet": 3, "switch": "on/off"}   // Kênh 4 (Dự phòng)
  ]
}
```

---

**Related:**
- [Stations API](./stations-api.md)
- [Recovery Mechanism](../architecture/recovery-mechanism.md)
- [Retry Strategy](../architecture/retry-strategy.md)
