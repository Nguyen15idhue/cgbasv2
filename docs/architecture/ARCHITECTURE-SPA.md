# CGBAS Recovery System - SPA Architecture

## 📁 Cấu trúc thư mục

```
cgbasv2/
├── public/
│   ├── index.html              # SPA Shell (entry point duy nhất)
│   │
│   ├── components/             # Reusable HTML components
│   │   ├── sidebar.html        # Sidebar navigation (không dùng trực tiếp)
│   │   └── topbar.html         # Top header bar (không dùng trực tiếp)
│   │
│   ├── partials/               # Page content partials (load động qua AJAX)
│   │   ├── dashboard.html      # Dashboard content
│   │   ├── queue.html          # Queue management content
│   │   ├── stations.html       # Stations list content
│   │   ├── devices.html        # eWelink devices content
│   │   ├── logs.html           # System logs content
│   │   └── settings.html       # Settings content
│   │
│   ├── views/
│   │   └── login.html          # Login page (standalone, không phải SPA)
│   │
│   ├── css/                    # Stylesheets
│   │   ├── master.css          # Global styles (layout, sidebar, topbar)
│   │   ├── dashboard.css       # Dashboard page styles
│   │   ├── queue.css           # Queue page styles
│   │   ├── stations.css        # Stations page styles
│   │   ├── devices.css         # Devices page styles
│   │   ├── logs.css            # Logs page styles
│   │   ├── settings.css        # Settings page styles
│   │   └── login.css           # Login page styles
│   │
│   └── js/                     # JavaScript files
│       ├── router.js           # SPA Router (navigation không reload)
│       ├── master.js           # Global JS (sidebar, logout, utilities)
│       ├── dashboard.js        # Dashboard logic
│       ├── queue.js            # Queue logic
│       ├── stations.js         # Stations logic
│       ├── devices.js          # Devices logic
│       ├── logs.js             # Logs logic
│       └── settings.js         # Settings logic
│
└── src/                        # Backend code
    ├── main.js                 # Express server
    ├── routes/                 # API routes
    ├── controllers/            # Business logic
    └── ...
```

## 🎯 Cách hoạt động

### 1. **SPA Shell (index.html)**
- Chứa cấu trúc layout cố định: sidebar, topbar, main-content
- Load 1 lần duy nhất khi người dùng truy cập
- Content area (`#mainContent`) được thay đổi động

### 2. **Router (router.js)**
- Xử lý navigation không reload trang
- Load partial HTML tương ứng khi user click menu
- Quản lý CSS và JS động cho từng page
- Hỗ trợ browser back/forward buttons

### 3. **Partials**
- Chỉ chứa nội dung trang, không có layout
- Load qua AJAX khi cần
- Nhẹ và nhanh

### 4. **CSS Organization**
- `master.css`: Global styles, layout, components
- Page-specific CSS: Chỉ styles cho page đó
- Load động theo page đang xem

### 5. **JavaScript Organization**
- `master.js`: Global utilities, sidebar, logout
- `router.js`: Navigation logic
- Page-specific JS: Logic riêng cho từng page

## 🚀 Workflow

1. User truy cập `/dashboard` → Server trả về `index.html`
2. `router.js` nhận path `/dashboard`
3. Load `partials/dashboard.html` vào `#mainContent`
4. Load `dashboard.css` (nếu cần)
5. Load `dashboard.js` và khởi tạo
6. User click menu `/stations` → Router load `partials/stations.html`
7. **Không reload trang**, chỉ thay content

## ✅ Ưu điểm

- ⚡ Nhanh: Không reload toàn trang
- 🎨 Organized: CSS, JS, HTML tách biệt rõ ràng
- ♻️ Reusable: Sidebar, topbar chỉ load 1 lần
- 🔧 Maintainable: Dễ sửa, dễ mở rộng
- 🎯 Clean: Không duplicate code

## 📝 Thêm page mới

1. Tạo `partials/newpage.html` (chỉ content)
2. Tạo `css/newpage.css` (optional)
3. Tạo `js/newpage.js` (optional)
4. Thêm route trong `router.js`:
   ```js
   '/newpage': {
       title: 'New Page',
       css: '/css/newpage.css',
       js: '/js/newpage.js'
   }
   ```
5. Thêm menu item trong `index.html` sidebar
6. Thêm server route trong `src/main.js`

Done! ✨
