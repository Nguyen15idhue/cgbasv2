Đây là tài liệu hướng dẫn kỹ thuật toàn diện dành cho lập trình viên (Technical Documentation) về hệ thống **RTK Station Auto-Recovery Middleware**.

---

# Tài liệu Kỹ thuật: Hệ thống Phục hồi Trạm RTK Tự động

## 1. Tổng quan hệ thống
Hệ thống là một Middleware xây dựng trên Node.js, kết nối giữa hệ thống giám sát trạm RTK (CGBAS PRO) và hệ thống điều khiển phần cứng (eWelink/SONOFF).

**Mục tiêu chính:** Tự động phát hiện trạm mất tín hiệu và thực hiện kịch bản điều khiển nguồn điện/nút kích để đưa trạm hoạt động trở lại mà không cần con người can thiệp.

---

## 2. Kiến trúc Thư mục (Project Structure)
```text
src/
├── config/             # Cấu hình kết nối MySQL Pool.
├── migrations/         # Các script tự động tạo DB/Table (001 -> 004).
├── routes/             # Định nghĩa API Endpoints (CGBAS & eWelink).
├── services/           
│   ├── cgbasApi.js     # Giao tiếp API CGBAS (Xử lý Signature).
│   ├── ewelinkService.js # Giao tiếp API eWelink (Duyệt Family/Pagination/Logs).
│   └── stationControlService.js # NÃO BỘ: Chứa kịch bản Bật/Tắt & Phục hồi.
├── repository/         # Tầng thao tác dữ liệu MySQL (CRUD).
├── utils/              
│   ├── autoMonitor.js  # Bộ giám sát: Quét trạm offline và điều phối Job.
│   ├── scheduler.js    # Bộ lập lịch: Chạy 15s/lần.
│   ├── helper.js       # Hàm bổ trợ: Sleep, Retry logic.
│   └── crypto.js       # Thuật toán mã hóa chữ ký CGBAS.
└── main.js             # Entry point: Khởi tạo Server, Cron và Sync ban đầu.
```

---

## 3. Cơ sở dữ liệu (Database Schema)

Hệ thống sử dụng MySQL với bảng mã `utf8mb4_unicode_ci`. Các bảng chính:
1.  **`stations`**: Lưu metadata trạm và ánh xạ tới `ewelink_device_id`.
2.  **`station_dynamic_info`**: Lưu trạng thái vệ tinh và kết nối (Cập nhật 15s/lần).
3.  **`ewelink_devices/status`**: Lưu thông tin phần cứng SONOFF.
4.  **`station_recovery_jobs`**: Theo dõi tiến trình phục hồi đang chạy.
5.  **`ewelink_api_logs`**: Nhật ký toàn bộ các lần gọi API eWelink (Sử dụng `LONGTEXT`).

---

## 4. Cơ chế Phục hồi Tự động (Core Logic)

Hệ thống hoạt động theo mô hình **Observer & State Machine**:

### 4.1. Chu kỳ Giám sát (15 giây/lần)
- Quét bảng `station_dynamic_info` tìm trạm có `connectStatus = 3` (Offline).
- Kiểm tra trạm đó đã có Job phục hồi nào đang chạy chưa.
- Nếu chưa: Tạo một bản ghi mới trong `station_recovery_jobs` với trạng thái `PENDING`.

### 4.2. Kịch bản Phục hồi Thích ứng (Adaptive Script)
Khi một Job được thực thi, hệ thống kiểm tra trạng thái Online và Nguồn của SONOFF:

1.  **Nếu SONOFF Offline:** Hẹn lịch thử lại sau `[2, 5, 7, 10, 15, 30]` phút.
2.  **Nếu Nguồn (Kênh 1) đang OFF:** Thực hiện **Full kịch bản** (Bật nguồn -> Đợi 10s -> Kích nút 5s -> Nhả nút).
3.  **Nếu Nguồn (Kênh 1) đang ON:** Chỉ thực hiện **Kịch bản Kích** (Kích nút 5s -> Nhả nút).

### 4.3. Xác minh kết quả
- Sau khi điều khiển xong, Job chuyển sang trạng thái `CHECKING`.
- Hệ thống **đợi 2 phút** để trạm khởi động.
- Kiểm tra lại tín hiệu trên CGBAS:
    - Nếu Online: Xóa Job (Thành công).
    - Nếu vẫn Offline: Tái lập lịch (Reschedule) để chạy lại toàn bộ quy trình sau một khoảng nghỉ.

---

## 5. Các API Endpoints nội bộ

### Nhóm CGBAS (Giám sát)
- `GET /api/stations/status`: Trả về danh sách trạm kèm tọa độ và số lượng vệ tinh hiện tại.

### Nhóm eWelink (Điều khiển)
- `GET /api/ewelink/devices`: Danh sách thiết bị SONOFF và trạng thái switch.
- `POST /api/ewelink/control`: Điều khiển bật/tắt lẻ từng kênh.
- `POST /api/ewelink/station-on`: Kích hoạt thủ công kịch bản bật trạm (Full flow).
- `POST /api/ewelink/station-off`: Kịch bản tắt trạm an toàn.
- `GET /api/ewelink/api-stats`: Thống kê số lần gọi API, lịch sử Request/Response và độ trễ.

---

## 6. Cơ chế Retry & Logging

### 6.1. Retry nội bộ (Step-Retry)
Sử dụng hàm `retryAction` trong `helper.js`. Mỗi lệnh gửi đi nếu thất bại (Cloud bận/Timeout), hệ thống tự thử lại **5 lần**, mỗi lần cách nhau 2 giây trước khi báo lỗi bước đó.

### 6.2. Logging API
Sử dụng Axios Interceptors. Mọi Request lên eWelink đều được ghi lại:
- `Payload`: Dữ liệu gửi đi.
- `Response Body`: Dữ liệu Cloud trả về.
- `Duration`: Thời gian phản hồi của Cloud (ms).

---

## 7. Hướng dẫn Triển khai (Deployment)

1.  **Môi trường:** Cài đặt Node.js và MySQL (Khuyên dùng Laragon).
2.  **Database:** Tạo database `cgbas_db`.
3.  **Cấu hình:** Chỉnh sửa file `.env` (AK/SK của CGBAS, Token của eWelink, thông tin DB).
4.  **Cài đặt thư viện:** `npm install`.
5.  **Khởi chạy:** `npm start`.
6.  **Ánh xạ:** Sau khi chạy lần đầu, hãy vào bảng `stations` và điền ID thiết bị eWelink tương ứng vào cột `ewelink_device_id` cho các trạm cần quản lý tự động.

---

## 8. Lưu ý quan trọng cho Dev
- **Collation:** Đảm bảo toàn bộ DB dùng `utf8mb4_unicode_ci` để tránh lỗi so sánh chuỗi khi `JOIN` các bảng.
- **Rate Limit:** eWelink có giới hạn tần suất gọi API. Cơ chế `RETRY_INTERVALS` giúp bảo vệ tài khoản không bị khóa.
- **An toàn phần cứng:** Kịch bản đã bao gồm thời gian `sleep` để bảo vệ linh kiện điện tử không bị sốc nhiệt/điện khi chuyển mạch liên tục.