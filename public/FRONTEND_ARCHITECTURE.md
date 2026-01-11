# Frontend Architecture Guide

## 📁 Cấu Trúc Thư Mục

```
public/
├── components/           # Các component có thể tái sử dụng
│   ├── header.html      # Header với search, notifications, user profile
│   ├── footer.html      # Footer với links và version info
│   ├── navigation.html  # Sidebar navigation menu
│   └── loader.html      # Loading spinner component
│
├── css/
│   ├── variables.css    # CSS variables (colors, spacing, fonts)
│   ├── global.css       # Global styles (layout, components)
│   ├── responsive.css   # Responsive & mobile styles
│   ├── master.css       # [Legacy] Old master CSS
│   └── pages/           # Page-specific styles
│       └── dashboard.css
│
├── js/
│   ├── core/
│   │   └── componentLoader.js  # Dynamic component loading system
│   ├── utils/
│   │   ├── ajax.js            # AJAX/Fetch wrapper với error handling
│   │   ├── api.js             # API client với các endpoint cụ thể
│   │   ├── helpers.js         # Helper functions (format, toast, etc.)
│   │   └── responsive.js      # Responsive utilities & mobile menu
│   ├── pages/
│   │   └── dashboard.js       # Dashboard-specific logic
│   └── [legacy files]         # Các file JS cũ
│
└── views/
    ├── dashboard-new.html     # Ví dụ template mới
    └── [other pages]          # Các trang khác
```

## 🎨 CSS Architecture

### 1. Variables (variables.css)
Chứa tất cả design tokens:
- **Layout**: `--sidebar-width`, `--topbar-height`, etc.
- **Colors**: Primary, secondary, semantic (success, warning, danger, info)
- **Spacing**: `--spacing-xs` đến `--spacing-2xl`
- **Typography**: Font sizes, weights
- **Shadows & Radius**: `--shadow-sm` đến `--shadow-xl`
- **Transitions**: `--transition-fast`, `--transition-base`

```css
/* Sử dụng trong code */
.my-element {
    padding: var(--spacing-md);
    color: var(--primary-color);
    border-radius: var(--radius-lg);
    transition: all var(--transition-base);
}
```

### 2. Global Styles (global.css)
Styles chung cho toàn bộ app:
- Reset & Base styles
- Layout structure (sidebar, topbar, main-content)
- Component styles (buttons, cards, tables)
- Utility classes (text-center, mt-1, mb-2, etc.)
- Animations (@keyframes)

### 3. Responsive Styles (responsive.css)
Breakpoints và mobile optimization:
- **Mobile**: ≤ 576px
- **Tablet**: ≤ 768px
- **Desktop**: ≤ 992px
- **Wide**: ≤ 1200px

Tính năng:
- Mobile sidebar overlay
- Touch-friendly UI
- Optimized for different screen sizes
- Print styles

### 4. Page-Specific Styles (css/pages/)
CSS riêng cho từng trang, chỉ load khi cần:
```html
<link rel="stylesheet" href="/css/pages/dashboard.css">
```

## 🔧 JavaScript Architecture

### 1. Core System (js/core/)

#### componentLoader.js
Load components động vào page:
```javascript
// Auto-load tất cả components
await ComponentLoader.loadAll();

// Load component cụ thể
await ComponentLoader.insertComponent('header', '#headerContainer');
```

### 2. Utilities (js/utils/)

#### ajax.js - AJAX Client
```javascript
// GET request
const data = await ajax.get('/stations/list', { status: 1 });

// POST request
await ajax.post('/stations/recover', { stationId: 123 });

// Error handling tự động
// 401 -> redirect to login
```

#### api.js - API Wrapper
```javascript
// Sử dụng API endpoints đã định nghĩa sẵn
const stations = await API.stations.list();
const stats = await API.stations.getRecoveryStats();
await API.auth.logout();
```

#### helpers.js - Helper Functions
```javascript
// Format date
Helpers.formatDate(new Date(), 'full');
Helpers.formatRelativeTime(date); // "5 phút trước"

// Toast notifications
Helpers.showToast('Thành công!', 'success');
Helpers.error('Có lỗi xảy ra', 'Chi tiết lỗi');

// Confirm dialog
const confirmed = await Helpers.confirm('Xác nhận?', 'Bạn có chắc?');

// Loading
Helpers.showLoading('Đang xử lý...');
Helpers.hideLoading();

// Local storage
Helpers.storage.set('key', { data: 'value' });
const data = Helpers.storage.get('key');
```

#### responsive.js - Responsive Utilities
```javascript
// Check breakpoint
if (Responsive.isMobile()) {
    // Mobile-specific code
}

// Listen to breakpoint changes
window.addEventListener('breakpointChange', (e) => {
    console.log(`Changed from ${e.detail.from} to ${e.detail.to}`);
});

// Mobile menu
Responsive.openMobileMenu();
Responsive.closeMobileMenu();
```

### 3. Page Scripts (js/pages/)
Logic riêng cho từng page, follow class pattern:
```javascript
class DashboardPage {
    constructor() {
        this.init();
    }

    async init() {
        await this.waitForComponents();
        await this.loadData();
        this.setupEventListeners();
    }

    async loadData() {
        const data = await API.stations.getRecoveryStats();
        this.updateUI(data);
    }
}

// Auto-initialize
window.dashboardPage = new DashboardPage();
```

## 📄 HTML Template Structure

### Minimal Template
```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
    <title>Page Title - CGBAS Recovery System</title>
    
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- FontAwesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Custom CSS -->
    <link rel="stylesheet" href="/css/variables.css">
    <link rel="stylesheet" href="/css/global.css">
    <link rel="stylesheet" href="/css/responsive.css">
    <link rel="stylesheet" href="/css/pages/[page-name].css">
</head>
<body>
    <div class="app-wrapper">
        <!-- Navigation -->
        <div id="navigationContainer"></div>

        <div class="main-layout">
            <!-- Header -->
            <div id="headerContainer"></div>

            <!-- Main Content -->
            <main class="main-content">
                <!-- Your page content here -->
            </main>

            <!-- Footer -->
            <div id="footerContainer"></div>
        </div>
    </div>

    <!-- Loader -->
    <div id="loaderContainer"></div>

    <!-- External Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

    <!-- Core JavaScript -->
    <script src="/js/utils/ajax.js"></script>
    <script src="/js/utils/api.js"></script>
    <script src="/js/utils/helpers.js"></script>
    <script src="/js/utils/responsive.js"></script>
    <script src="/js/core/componentLoader.js"></script>

    <!-- Page JavaScript -->
    <script src="/js/pages/[page-name].js"></script>
</body>
</html>
```

## 🎯 Best Practices

### 1. CSS
- ✅ Sử dụng CSS variables từ `variables.css`
- ✅ Tránh inline styles
- ✅ Follow BEM naming convention cho custom components
- ✅ Sử dụng utility classes từ `global.css`
- ✅ Page-specific styles vào `css/pages/`

### 2. JavaScript
- ✅ Sử dụng `API` object thay vì direct fetch
- ✅ Sử dụng `Helpers` cho common tasks
- ✅ Async/await thay vì callbacks
- ✅ Try-catch cho error handling
- ✅ Class-based cho page scripts

### 3. Components
- ✅ Components load tự động qua `componentLoader.js`
- ✅ Không hard-code header/footer vào mỗi page
- ✅ Sử dụng `data-page` attribute để set active navigation

### 4. Responsive
- ✅ Mobile-first approach
- ✅ Test trên nhiều devices
- ✅ Sử dụng `Responsive` utilities
- ✅ Touch-friendly UI (min 44px tap targets)

## 📱 Mobile Features

1. **Swipe Gestures**
   - Swipe từ trái sang phải: Mở menu
   - Swipe từ phải sang trái: Đóng menu

2. **Hamburger Menu**
   - Auto-show trên mobile
   - Overlay khi menu mở
   - Close on outside click

3. **Responsive Tables**
   - Auto-wrap trong `.table-responsive`
   - Horizontal scroll on mobile

4. **Optimized Touch**
   - Larger tap targets
   - Disabled hover effects
   - Smooth scrolling

## 🚀 Migration Guide (Old → New)

### Step 1: Cập nhật HTML
```html
<!-- Old -->
<head>
    <link rel="stylesheet" href="/css/master.css">
</head>
<body>
    <div class="sidebar">...</div>
    <div class="topbar">...</div>
    <div class="main-content">...</div>
</body>

<!-- New -->
<head>
    <link rel="stylesheet" href="/css/variables.css">
    <link rel="stylesheet" href="/css/global.css">
    <link rel="stylesheet" href="/css/responsive.css">
</head>
<body>
    <div class="app-wrapper">
        <div id="navigationContainer"></div>
        <div class="main-layout">
            <div id="headerContainer"></div>
            <main class="main-content">...</main>
            <div id="footerContainer"></div>
        </div>
    </div>
    <div id="loaderContainer"></div>
</body>
```

### Step 2: Cập nhật JavaScript
```javascript
// Old
fetch('/api/stations/list')
    .then(res => res.json())
    .then(data => { ... });

// New
const data = await API.stations.list();
```

### Step 3: Cập nhật Styles
```css
/* Old */
.my-card {
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* New */
.my-card {
    padding: var(--spacing-lg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
}
```

## 🔍 Troubleshooting

### Components không load?
- Kiểm tra console có lỗi network không
- Verify paths trong `componentLoader.js`
- Đảm bảo các container div tồn tại

### Styles không hiển thị đúng?
- Kiểm tra thứ tự load CSS files
- Verify `variables.css` load trước
- Clear browser cache

### AJAX calls fail?
- Check console cho error details
- Verify API endpoints trong `api.js`
- Check CORS settings

### Mobile menu không hoạt động?
- Verify `responsive.js` đã load
- Check console cho errors
- Ensure sidebar và overlay elements exist

## 📚 References

- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.3/)
- [FontAwesome Icons](https://fontawesome.com/icons)
- [Chart.js Docs](https://www.chartjs.org/docs/)
- [SweetAlert2](https://sweetalert2.github.io/)

---

**Version**: 1.0.0  
**Last Updated**: January 11, 2026  
**Author**: CGBAS Development Team
