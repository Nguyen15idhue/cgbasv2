# 🔄 Migration Guide - Cập Nhật Các Trang sang Cấu Trúc Mới

## ✅ Đã Hoàn Thành

### 1. Component System
- ✅ [components/header.html](../components/header.html)
- ✅ [components/navigation.html](../components/navigation.html)
- ✅ [components/footer.html](../components/footer.html)
- ✅ [components/loader.html](../components/loader.html)

### 2. CSS Architecture
- ✅ [css/variables.css](../css/variables.css) - Design tokens
- ✅ [css/global.css](../css/global.css) - Common styles
- ✅ [css/responsive.css](../css/responsive.css) - Mobile optimization
- ✅ [css/pages/dashboard.css](../css/pages/dashboard.css) - Page-specific

### 3. JavaScript Utilities
- ✅ [js/utils/ajax.js](../js/utils/ajax.js) - AJAX client
- ✅ [js/utils/api.js](../js/utils/api.js) - API wrapper
- ✅ [js/utils/helpers.js](../js/utils/helpers.js) - Helper functions
- ✅ [js/utils/responsive.js](../js/utils/responsive.js) - Responsive utils
- ✅ [js/core/componentLoader.js](../js/core/componentLoader.js) - Component loader
- ✅ [js/pages/dashboard.js](../js/pages/dashboard.js) - Dashboard logic

### 4. Templates
- ✅ [views/dashboard-new.html](../views/dashboard-new.html) - Template mẫu hoàn chỉnh
- 🔄 [views/dashboard.html](../views/dashboard.html) - Đã cập nhật HEAD section
- 📝 Các trang khác cần cập nhật: stations, devices, queue, logs, settings

## 📋 Hướng Dẫn Cập Nhật Từng Trang

### Bước 1: Cập nhật HEAD Section

Thay thế phần `<head>` cũ bằng template mới:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
    <meta name="description" content="[Page Description]">
    <meta name="theme-color" content="#667eea">
    <title>[Page Title] - CGBAS Recovery System</title>
    
    <!-- Preconnect -->
    <link rel="preconnect" href="https://cdn.jsdelivr.net">
    <link rel="preconnect" href="https://cdnjs.cloudflare.com">
    
    <!-- External CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Custom CSS -->
    <link rel="stylesheet" href="/css/variables.css">
    <link rel="stylesheet" href="/css/global.css">
    <link rel="stylesheet" href="/css/responsive.css">
    <link rel="stylesheet" href="/css/pages/[page-name].css">
</head>
```

### Bước 2: Cập nhật BODY Structure

**CŨ:**
```html
<body>
    <!-- Sidebar -->
    <div class="sidebar">
        <!-- Sidebar content hard-coded -->
    </div>

    <!-- Main Content -->
    <div class="main-content">
        <!-- Topbar -->
        <div class="topbar">
            <!-- Topbar content hard-coded -->
        </div>

        <!-- Page Content -->
        <div class="page-content">
            <!-- Your content -->
        </div>
    </div>
</body>
```

**MỚI:**
```html
<body>
    <!-- App Wrapper -->
    <div class="app-wrapper">
        <!-- Navigation Sidebar (auto-loaded) -->
        <div id="navigationContainer"></div>

        <!-- Main Layout -->
        <div class="main-layout">
            <!-- Header (auto-loaded) -->
            <div id="headerContainer"></div>

            <!-- Main Content -->
            <main class="main-content" id="mainContent">
                <!-- Your page content here -->
                <div class="page-header">
                    <h1 class="page-title">
                        <i class="fas fa-[icon]"></i> [Page Title]
                    </h1>
                    <div class="page-actions">
                        <button class="btn btn-outline-primary">
                            <i class="fas fa-plus"></i> Action
                        </button>
                    </div>
                </div>

                <!-- Your specific content -->
                
            </main>

            <!-- Footer (auto-loaded) -->
            <div id="footerContainer"></div>
        </div>
    </div>

    <!-- Loader (auto-loaded) -->
    <div id="loaderContainer"></div>
</body>
```

### Bước 3: Cập nhật JavaScript Imports

**CŨ:**
```html
<!-- Bootstrap JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script src="/js/master.js"></script>
<script src="/js/[page-name].js"></script>
```

**MỚI:**
```html
<!-- External Libraries -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

<!-- Core JavaScript (load theo thứ tự) -->
<script src="/js/utils/ajax.js"></script>
<script src="/js/utils/api.js"></script>
<script src="/js/utils/helpers.js"></script>
<script src="/js/utils/responsive.js"></script>
<script src="/js/core/componentLoader.js"></script>

<!-- Page JavaScript -->
<script src="/js/pages/[page-name].js"></script>
```

### Bước 4: Update Page-Specific JavaScript

**CŨ:**
```javascript
// Trong /js/stations.js
document.addEventListener('DOMContentLoaded', async () => {
    const response = await fetch('/api/stations/list');
    const data = await response.json();
    // Process data...
});
```

**MỚI:**
```javascript
// Trong /js/pages/stations.js
class StationsPage {
    constructor() {
        this.init();
    }

    async init() {
        // Wait for components to load
        await this.waitForComponents();
        
        // Load data using API wrapper
        await this.loadStations();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    async waitForComponents() {
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (document.querySelector('.sidebar')) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
    }

    async loadStations() {
        try {
            Helpers.showLoading('Đang tải danh sách trạm...');
            const data = await API.stations.list();
            this.renderStations(data);
            Helpers.hideLoading();
        } catch (error) {
            console.error('Error:', error);
            Helpers.showToast('Có lỗi xảy ra', 'error');
        }
    }

    renderStations(data) {
        // Render logic here
    }

    setupEventListeners() {
        // Event listeners
    }
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.stationsPage = new StationsPage();
    });
} else {
    window.stationsPage = new StationsPage();
}
```

## 🎯 Chi Tiết Cho Từng Trang

### 1. Stations Page

**data-page attribute**: `data-page="stations"`

**Icon**: `fa-broadcast-tower`

**CSS**: Create `css/pages/stations.css`

**JS**: Create `js/pages/stations.js`

**Content Structure**:
```html
<main class="main-content">
    <div class="page-header">
        <h1 class="page-title">
            <i class="fas fa-broadcast-tower"></i> Quản lý Trạm
        </h1>
        <div class="page-actions">
            <input type="text" class="form-control" placeholder="Tìm kiếm..." id="searchStation">
            <select class="form-select" id="filterStatus">
                <option value="">Tất cả</option>
                <option value="1">Online</option>
                <option value="3">Offline</option>
            </select>
            <button class="btn btn-primary" id="btnRefresh">
                <i class="fas fa-sync-alt"></i> Làm mới
            </button>
        </div>
    </div>

    <!-- Station Stats Cards -->
    <div class="stat-grid mb-4">
        <!-- Stats here -->
    </div>

    <!-- Stations Table -->
    <div class="card">
        <div class="card-header">
            <h5><i class="fas fa-table"></i> Danh sách trạm</h5>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-hover" id="stationsTable">
                    <thead>
                        <tr>
                            <th>Tên trạm</th>
                            <th>Trạng thái</th>
                            <th>Vệ tinh</th>
                            <th>Device</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="stationsTableBody">
                        <!-- Data loaded by JS -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</main>
```

### 2. Devices Page

**data-page**: `devices`  
**Icon**: `fa-microchip`  
**Files**: `css/pages/devices.css`, `js/pages/devices.js`

### 3. Queue Page

**data-page**: `queue`  
**Icon**: `fa-tasks`  
**Files**: `css/pages/queue.css`, `js/pages/queue.js`

### 4. Logs Page

**data-page**: `logs`  
**Icon**: `fa-history`  
**Files**: `css/pages/logs.css`, `js/pages/logs.js`

### 5. Settings Page

**data-page**: `settings`  
**Icon**: `fa-cog`  
**Files**: `css/pages/settings.css`, `js/pages/settings.js`

## ⚡ Quick Migration Steps

1. **Backup files cũ** (Đã làm ✅)
   ```bash
   public/views/*-old.html
   ```

2. **Sử dụng template** từ `dashboard-new.html`

3. **Tạo page-specific CSS** trong `css/pages/[page-name].css`

4. **Tạo page-specific JS** trong `js/pages/[page-name].js` theo class pattern

5. **Test responsive** trên mobile, tablet, desktop

6. **Test functionality** với API calls

## 🔧 Debugging Tips

### Components không load?
```javascript
// Check console
console.log('ComponentLoader loaded:', typeof ComponentLoader !== 'undefined');
console.log('Components:', ComponentLoader.cache);
```

### Styles không áp dụng?
- Kiểm tra thứ tự load CSS (variables → global → responsive → page)
- Clear browser cache (Ctrl + F5)
- Check console cho CSS errors

### API calls fail?
```javascript
// Check API object
console.log('API loaded:', typeof API !== 'undefined');
console.log('ajax loaded:', typeof ajax !== 'undefined');

// Test API call
try {
    const data = await API.stations.list();
    console.log('Data:', data);
} catch (error) {
    console.error('API Error:', error);
}
```

### Mobile menu không hoạt động?
- Check responsive.js đã load chưa
- Verify sidebar và overlay elements
- Check console errors

## 📱 Testing Checklist

- [ ] Desktop (≥ 992px)
- [ ] Tablet (768px - 991px)
- [ ] Mobile (≤ 767px)
- [ ] Portrait mode
- [ ] Landscape mode
- [ ] Touch gestures (swipe menu)
- [ ] All API calls work
- [ ] Loading indicators show
- [ ] Error handling works
- [ ] Logout works
- [ ] Navigation active states
- [ ] Search functionality
- [ ] Filters work
- [ ] Tables responsive
- [ ] Charts display correctly

## 🚀 Next Steps

1. ✅ Component system created
2. ✅ CSS architecture established
3. ✅ JavaScript utilities ready
4. ✅ Dashboard template created
5. 📝 **TODO: Update remaining pages**
   - stations.html
   - devices.html
   - queue.html
   - logs.html
   - settings.html

## 📚 Resources

- [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) - Full documentation
- [dashboard-new.html](../views/dashboard-new.html) - Template reference
- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.3/)
- [FontAwesome Icons](https://fontawesome.com/icons)

---

**Last Updated**: January 11, 2026  
**Status**: 🔄 In Progress - Core system ready, pages migration pending
