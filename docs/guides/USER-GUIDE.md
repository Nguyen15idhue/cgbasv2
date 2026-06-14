# Hướng dẫn sử dụng - Hệ thống CGBAS v2

## 1. Giới thiệu

**CGBAS v2** là hệ thống giám sát và tự động phục hồi trạm RTK. Hệ thống giúp bạn:
- Theo dõi trạng thái hoạt động của các trạm RTK
- Tự động phục hồi trạm khi gặp sự cố
- Điều khiển bật/tắt trạm từ xa
- Lên lịch tắt/bật trạm tự động hàng ngày
- Xem báo cáo và lịch sử hoạt động

---

## 2. Đăng nhập hệ thống

### Bước 1: Truy cập địa chỉ
Mở trình duyệt và truy cập địa chỉ server, ví dụ: `http://localhost:3001`

### Bước 2: Nhập thông tin đăng nhập
- **Tên đăng nhập**: Nhập username
- **Mật khẩu**: Nhập mật khẩu
- Nhấn nút **Đăng nhập**

### Bước 3: Đăng xuất
- Click vào tên user ở góc trên bên phải
- Chọn **Đăng xuất**

> **Lưu ý**: Sau 24 giờ không hoạt động, hệ thống sẽ tự động đăng xuất.

---

## 3. Các trang chức năng

### 3.1. Dashboard - Trang tổng quan

**Vị trí**: Click vào menu **Tổng quan** hoặc trang chủ

**Nội dung hiển thị**:
- **Trạm Online**: Số trạm đang hoạt động bình thường
- **Trạm Offline**: Số trạm đang offline (mất kết nối)
- **Đang xử lý**: Số job phục hồi đang chạy
- **Phục hồi hôm nay**: Số trạm đã phục hồi thành công trong ngày
- **Hoạt động gần đây**: Danh sách các lần phục hồi gần nhất
- **Trạng thái hệ thống**: Hiển thị trạng thái API CGBAS, eWeLink, Scheduler, Database

---

### 3.2. Trạm - Danh sách trạm CGBAS

**Vị trí**: Click vào menu **Trạm**

**Chức năng**:

| Tính năng | Mô tả |
|-----------|-------|
| Tìm kiếm | Nhập tên trạm, mã trạm vào ô tìm kiếm |
| Lọc trạng thái | Chọn Online/Offline để lọc |
| Phân trang | Xem theo từng trang (mặc định 20 trạm/trang) |

**Bảng thông tin trạm**:
| Cột | Mô tả |
|-----|-------|
| Tên trạm | Tên của trạm RTK |
| Tên định danh | Mã định danh trạm |
| Trạng thái | Online (xanh) / Offline (đỏ) |
| Vệ tinh | Số vệ tinh GPS/BeiDou/Galileo/GLONASS |
| Độ trễ | Độ trễ tính theo mili giây (ms) |
| Device ID | ID thiết bị eWeLink đang kết nối |
| Thao tác | Các nút điều khiển |

**Thao tác với trạm**:
- **Phục hồi**: Thêm trạm vào hàng đợi phục hồi (nếu offline)
- **Gán eWeLink**: Gán thiết bị eWeLink cho trạm
- **Xóa eWeLink**: Bỏ gán thiết bị eWeLink
- **Bật/Tắt trạm**: Kích hoạt hoặc vô hiệu hóa trạm

---

### 3.3. Thiết bị - Danh sách thiết bị eWeLink

**Vị trí**: Click vào menu **Thiết bị**

**Chức năng**:
- Tìm kiếm thiết bị theo tên hoặc ID
- Phân trang danh sách

**Bảng thông tin thiết bị**:
| Cột | Mô tả |
|-----|-------|
| Tên thiết bị | Tên thiết bị trong eWeLink |
| Device ID | ID thiết bị trên eWeLink Cloud |
| Kênh 1 | Trạng thái bật/tắt (on/off) |
| Kênh 2 | Trạng thái bật/tắt (on/off) |
| Điện áp | Điện áp hiện tại (V) |
| Cập nhật | Thời gian cập nhật trạng thái cuối |
| Thao tác | Nút điều khiển |

**Điều khiển thiết bị**:
- **Bật Kênh 1**: Bật relay nguồn (Power)
- **Tắt Kênh 1**: Tắt relay nguồn
- **Bật Kênh 2**: Bật relay reset (kích nút)
- **Tắt Kênh 2**: Tắt relay reset

---

### 3.4. Hàng đợi - Job phục hồi đang chạy

**Vị trí**: Click vào menu **Hàng đợi**

**Mục đích**: Xem các job phục hồi đang chờ hoặc đang chạy

**Bảng thông tin**:
| Cột | Mô tả |
|-----|-------|
| Tên trạm | Tên trạm đang được phục hồi |
| Thiết bị | Tên thiết bị eWeLink |
| Trạng thái | PENDING / RUNNING / CHECKING |
| Lần thử | Số lần đã thử |
| Thời gian chạy tiếp | Thời gian dự kiến chạy lại |
| Thao tác | Xóa khỏi hàng đợi |

---

### 3.5. Lịch sử - Lịch sử phục hồi

**Vị trí**: Click vào menu **Lịch sử**

**Chức năng**:
- Xem lịch sử tất cả các lần phục hồi trạm
- Lọc theo trạng thái (SUCCESS / FAILED / SKIPPED)
- Phân trang

**Thông tin hiển thị**:
| Cột | Mô tả |
|-----|-------|
| Tên trạm | Trạm được phục hồi |
| Trạng thái | Thành công / Thất bại / Bỏ qua |
| Số lần thử | Tổng số lần thử |
| Thời gian | Thời gian bắt đầu và kết thúc |
| Lý do | Lý do thất bại (nếu có) |

**Thống kê**:
- Tổng số lần phục hồi
- Số lần thành công / thất bại
- Thời gian trung bình phục hồi thành công

---

### 3.6. Báo cáo - Thống kê API

**Vị trí**: Click vào menu **Báo cáo**

**Chức năng**:
- Xem thống kê số lần gọi API eWeLink
- Lọc theo ngày/tháng/năm

**Thông tin hiển thị**:
- Tổng số lần gọi API
- Số lần thành công / lỗi
- Thời gian phản hồi trung bình
- Top các endpoint được gọi nhiều nhất
- Thống kê theo thiết bị

---

### 3.7. Logs - Nhật ký hệ thống

**Vị trí**: Click vào menu **Logs**

**Mục đích**: Xem chi tiết các lỗi xảy ra trong hệ thống

---

### 3.8. Cấu hình - Settings

**Vị trí**: Click vào menu **Cấu hình**

#### Tab eWeLink
- **App ID**: ID ứng dụng eWeLink
- **App Secret**: Secret key của ứng dụng
- **API URL**: Địa chỉ API eWeLink
- **Access Token**: Token truy cập
- **Refresh Token**: Token làm mới
- **Đăng nhập eWeLink**: Kết nối qua OAuth (đăng nhập bằng tài khoản eWeLink)
- **Làm mới token**: Refresh token thủ công
- **Test token**: Kiểm tra token có hoạt động không

#### Tab Scheduled Shutdown
- **Bật/Tắt**: Kích hoạt tính năng tắt/bật tự động
- **Giờ tắt**: Thời điểm tắt trạm hàng ngày (VD: 02:00:00)
- **Thời gian tắt**: Số phút trạm sẽ tắt (1-5 phút)
- **Số trạm/batch**: Số trạm xử lý mỗi lần (tránh quá tải API)
- **Delay giữa các batch**: Thời gian chờ giữa các batch (giây)
- **Thực thi**: Chạy thủ công quy trình tắt/bật
- **Hủy**: Hủy quy trình đang chạy
- **Xem trạng thái**: Theo dõi tiến trình đang chạy

#### Tab Đổi mật khẩu
- **Mật khẩu hiện tại**: Nhập mật khẩu hiện tại
- **Mật khẩu mới**: Nhập mật khẩu mới
- **Xác nhận mật khẩu**: Nhập lại mật khẩu mới
- Nhấn **Đổi mật khẩu** để lưu

---

## 4. Quy trình phục hồi tự động

### 4.1. Khi nào hệ thống tự động phục hồi?

Hệ thống sẽ tự động phục hồi trạm khi:
- Trạm **Offline** (Status 3) liên tục **≥ 30 giây**
- Trạm **Lost Data** (Status 2) liên tục **≥ 5 phút**
- Trạm đã được **gán thiết bị eWeLink**
- Trạm đang ở trạng thái **Active** (không bị vô hiệu hóa)

### 4.2. Các bước phục hồi

1. **Kiểm tra thiết bị eWeLink**
   - Nếu thiết bị **OFFLINE** → Nguyên nhân mất điện, thử lại chậm (3, 3, 5, 10, 60, 120 phút)
   - Nếu thiết bị **ONLINE** → Nguyên nhân lỗi phần mềm, thử lại nhanh (2, 2, 3, 5, 10, 20 phút)

2. **Thực hiện kịch bản phục hồi**
   - Bật Kênh 1 (nguồn)
   - Bật Kênh 2 (kích reset)
   - Tắt Kênh 2
   - Chờ 90 giây kiểm tra kết quả

3. **Kết quả**
   - **Thành công**: Trạm online → Lưu lịch sử, xóa khỏi hàng đợi
   - **Thất bại**: Thử lại theo lịch retry tương ứng
   - **Giới hạn**: Sau 6 lần thử thất bại → Đánh dấu FAILED

### 4.3. Phân biệt nguyên nhân

| Tình huống | Nguyên nhân | Hành động |
|------------|-------------|-----------|
| eWeLink OFFLINE | Mất điện | Thử lại chậm |
| eWeLink ONLINE, trạm offline | Lỗi phần mềm/treo máy | Thử lại nhanh |

---

## 5. Quy trình Scheduled Shutdown

### 5.1. Hoạt động như thế nào?

1. **Giờ tắt**: Đến giờ cấu hình (VD: 2:00 AM), hệ thống sẽ:
   - Tắt Kênh 1 của tất cả trạm đang active
   - Xử lý theo batch để tránh quá tải API

2. **Chờ**: Sau thời gian cấu hình (VD: 3 phút)

3. **Giờ bật**: Hệ thống sẽ:
   - Bật lại Kênh 1 của tất cả trạm
   - Xử lý theo batch

### 5.2. Cấu hình khuyến nghị

| Tham số | Giá trị khuyến nghị | Mô tả |
|---------|---------------------|-------|
| Giờ tắt | 02:00:00 | Tắt vào 2h sáng |
| Thời gian tắt | 3-5 phút | Thời gian trạm tắt nguồn |
| Số trạm/batch | 5 | Số trạm xử lý mỗi lần |
| Delay | 10-15 giây | Chờ giữa các batch |

---

## 6. Xử lý sự cố

### 6.1. Trạm không phục hồi

1. Kiểm tra **thiết bị eWeLink** có online không
2. Kiểm tra **kết nối điện** của trạm
3. Kiểm tra **token eWeLink** còn hạn không (vào Cấu hình → eWeLink)
4. Xem **lịch sử phục hồi** để biết lỗi chi tiết

### 6.2. Token eWeLink hết hạn

1. Vào **Cấu hình** → Tab **eWeLink**
2. Nhấn nút **Đăng nhập eWeLink** để xác thực lại
3. Hoặc nhấn **Làm mới token** để refresh thủ công

### 6.3. Scheduled Shutdown không chạy

1. Kiểm tra **cấu hình**: Đã bật tính năng chưa?
2. Kiểm tra **giờ tắt**: Cấu hình đúng định dạng HH:MM:SS?
3. Kiểm tra **Logs** để xem lỗi

---

## 7. Các mã trạng thái

### Trạng thái trạm (connectStatus)

| Mã | Ý nghĩa | Màu |
|----|---------|-----|
| 0 | Chưa kết nối | Xám |
| 1 | Online | Xanh |
| 2 | Chưa định vị | Vàng |
| 3 | Offline | Đỏ |

### Trạng thái Job phục hồi

| Trạng thái | Mô tả |
|------------|-------|
| PENDING | Đang chờ |
| RUNNING | Đang chạy |
| CHECKING | Đang kiểm tra kết quả |
| SUCCESS | Phục hồi thành công |
| FAILED | Phục hồi thất bại |
| SKIPPED | Bỏ qua (do đang scheduled shutdown) |

---

## 8. Liên hệ hỗ trợ

Nếu gặp vấn đề không thể giải quyết:
- Xem logs tại trang **Logs**
- Kiểm tra thông tin tại **Cấu hình**
- Liên hệ quản trị viên hệ thống

---

*Hướng dẫn sử dụng - CGBAS v2*