# 📘 CGBAS Proxy – Local API Documentation

Tài liệu này mô tả các **API endpoints** của ứng dụng **Node.js (CGBAS Proxy)** chạy tại địa chỉ mặc định:

```
http://localhost:3000
```

Hệ thống tự động **đồng bộ dữ liệu từ CGBAS PRO mỗi 15 giây** và lưu trữ tại Database local để phục vụ client.

---

## 1. Thông tin chung

- **Base URL:** `http://localhost:3000` (hoặc IP server)
- **Định dạng dữ liệu:** JSON
- **Bảng mã:** UTF-8
- **Cơ chế cập nhật:** Auto sync mỗi 15 giây

---

## 2. Danh sách API

### 2.1. Lấy toàn bộ danh sách trạm & trạng thái vệ tinh

API chính dùng để:
- Hiển thị bản đồ trạm GNSS
- Trang quản lý / monitoring
- Kết hợp dữ liệu cấu hình trạm và dữ liệu động (vệ tinh, delay)

**Endpoint**
```http
GET /api/stations-status
```

**Query parameters:** Không có

#### Response (JSON)

```json
{
  "success": true,
  "total": 65,
  "data": [
    {
      "id": "36",
      "stationName": "BGG3",
      "identificationName": "tt Đồi Ngô",
      "lat": 21.311513981944444,
      "lng": 106.3864189386111,
      "receiverType": "CHC P5U",
      "antennaType": "CHCC220GR CHCD",
      "status": 1,
      "connectStatus": 1,
      "delay": "619",
      "sat_R": 4,
      "sat_C": 21,
      "sat_E": 6,
      "sat_G": 8,
      "lastDynamicUpdate": "2023-11-01T08:00:15.000Z"
    }
  ]
}
```

#### Giải thích các trường dữ liệu

| Trường | Ý nghĩa | Ghi chú |
|------|--------|--------|
| `id` | ID trạm | Định danh duy nhất |
| `stationName` | Tên viết tắt trạm | VD: AGG1, BGG3 |
| `identificationName` | Tên mô tả trạm | Vị trí hoặc địa danh |
| `lat`, `lng` | Tọa độ trạm | WGS84 |
| `receiverType` | Loại máy thu | VD: CHC P5U |
| `antennaType` | Loại anten | Theo cấu hình trạm |
| `status` | Trạng thái quản lý | `1`: Hoạt động, `0`: Ngừng |
| `connectStatus` | Trạng thái kết nối | `1`: Online, `3`: Offline |
| `delay` | Độ trễ tín hiệu | Miliseconds (ms) |
| `sat_G` | Số vệ tinh GPS | Mỹ |
| `sat_R` | Số vệ tinh GLONASS | Nga |
| `sat_C` | Số vệ tinh BEIDOU | Trung Quốc |
| `sat_E` | Số vệ tinh GALILEO | Châu Âu |
| `lastDynamicUpdate` | Lần cập nhật cuối | ISO Timestamp |

---

### 2.2. Đồng bộ dữ liệu thủ công (Tùy chọn)

Dùng khi bạn **không muốn chờ chu kỳ 15 giây**, API sẽ ép hệ thống lấy dữ liệu mới từ CGBAS ngay lập tức.

**Endpoint**
```http
POST /api/sync
```

#### Response

```json
{
  "success": true,
  "message": "Đã đồng bộ lại dữ liệu thành công."
}
```

---

## 3. Mã lỗi thường gặp

### 500 – Internal Server Error

Xảy ra khi:
- Lỗi Database local
- Mất kết nối đến CGBAS PRO

```json
{
  "success": false,
  "message": "Chi tiết lỗi..."
}
```

---

## 4. Ví dụ gọi API

### JavaScript (Fetch API)

```javascript
fetch('http://localhost:3000/api/stations-status')
  .then(response => response.json())
  .then(res => {
    if (res.success) {
      console.log('Tổng số trạm:', res.total);
      const onlineStations = res.data.filter(
        s => s.connectStatus === 1
      );
      console.log('Số trạm đang online:', onlineStations.length);
    }
  });
```

---

## 5. Lưu ý dành cho lập trình viên

- **Hiệu năng:**  
  API đọc dữ liệu từ Database local, tốc độ phản hồi rất nhanh  
  👉 Thông thường **< 50ms**

- **Cache phía Client:**  
  Không cần thiết, vì dữ liệu đã được server cập nhật định kỳ

- **Tần suất gọi API:**  
  Client có thể gọi liên tục để refresh UI, dữ liệu luôn là bản mới nhất trong DB

- **CORS:**  
  Nếu gọi API từ website khác domain:

  ```bash
  npm install cors
  ```

  ```js
  const cors = require('cors');
  app.use(cors());
  ```

---

## 6. Ghi chú mở rộng (Optional)

- Phù hợp để tích hợp với:
  - Web Dashboard
  - GIS / Map (Leaflet, Mapbox, Google Maps)
  - Mobile App
- Có thể mở rộng thêm:
  - API chi tiết từng trạm
  - WebSocket realtime
  - Chuẩn hóa OpenAPI / Swagger

---

📌 **Tài liệu này dùng làm `README.md` cho dự án CGBAS Proxy Local API**

