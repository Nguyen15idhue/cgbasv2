// SPA Router - Single Page Application Navigation

// Store active intervals to clear them on navigation
let activeIntervals = [];

const routes = {
    '/': '/partials/dashboard.html',
    '/dashboard': '/partials/dashboard.html',
    '/queue': '/partials/queue.html',
    '/stations': '/partials/stations.html',
    '/devices': '/partials/devices.html',
    '/logs': '/partials/logs.html',
    '/settings': '/partials/settings.html'
};

// Clear all active intervals
function clearAllIntervals() {
    activeIntervals.forEach(intervalId => clearInterval(intervalId));
    activeIntervals = [];
    
    // Also clear any window-level intervals
    if (window.dashboardInterval) {
        clearInterval(window.dashboardInterval);
        window.dashboardInterval = null;
    }
    if (window.queueInterval) {
        clearInterval(window.queueInterval);
        window.queueInterval = null;
    }
    if (window.stationsInterval) {
        clearInterval(window.stationsInterval);
        window.stationsInterval = null;
    }
    if (window.devicesInterval) {
        clearInterval(window.devicesInterval);
        window.devicesInterval = null;
    }
    if (window.logsInterval) {
        clearInterval(window.logsInterval);
        window.logsInterval = null;
    }
}

// Page configurations
const pageConfig = {
    '/dashboard': {
        title: 'Dashboard',
        css: '/css/dashboard.css',
        js: '/js/dashboard.js'
    },
    '/queue': {
        title: 'Hàng đợi phục hồi',
        css: '/css/queue.css',
        js: '/js/queue.js'
    },
    '/stations': {
        title: 'Danh sách trạm',
        css: '/css/stations.css',
        js: '/js/stations.js'
    },
    '/devices': {
        title: 'Thiết bị eWelink',
        css: '/css/devices.css',
        js: '/js/devices.js'
    },
    '/logs': {
        title: 'Nhật ký hệ thống',
        css: '/css/logs.css',
        js: '/js/logs.js'
    },
    '/settings': {
        title: 'Cài đặt',
        css: '/css/settings.css',
        js: '/js/settings.js'
    }
};

// Navigate to a route
async function navigateTo(url) {
    const path = url || '/dashboard';
    const route = routes[path] || routes['/dashboard'];
    
    // Update URL without reload
    window.history.pushState({}, '', path);
    
    // Clear all intervals from previous page
    clearAllIntervals();
    
    // Update active menu
    updateActiveMenu(path);
    
    // Update page title
    const config = pageConfig[path] || pageConfig['/dashboard'];
    document.getElementById('pageTitle').textContent = config.title;
    document.title = `${config.title} - CGBAS System`;
    
    // Load page CSS
    const pageCssLink = document.getElementById('pageCss');
    if (config.css) {
        pageCssLink.href = config.css;
    } else {
        pageCssLink.href = '';
    }
    
    // Show loading
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="text-center py-5">
            <i class="fas fa-spinner fa-spin fa-3x text-primary"></i>
            <p class="mt-3">Đang tải...</p>
        </div>
    `;
    
    try {
        // Fetch partial HTML
        const response = await fetch(route);
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load page');
        }
        
        const html = await response.text();
        mainContent.innerHTML = html;
        
        // Remove old page script if exists
        const oldScript = document.getElementById('pageScript');
        if (oldScript) {
            oldScript.remove();
        }
        
        // Load page-specific JavaScript
        if (config.js) {
            const script = document.createElement('script');
            script.id = 'pageScript';
            script.src = config.js + '?t=' + Date.now(); // Cache bust
            script.onload = () => {
                // Wait for next tick to ensure DOM is ready
                setTimeout(() => {
                    initializePage(path);
                }, 0);
            };
            document.body.appendChild(script);
        } else {
            // Initialize inline scripts
            setTimeout(() => {
                initializePage(path);
            }, 0);
        }
        
    } catch (error) {
        console.error('Navigation error:', error);
        mainContent.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <h4>Lỗi tải trang</h4>
                <p class="text-muted">Không thể tải nội dung. Vui lòng thử lại.</p>
                <button class="btn btn-primary" onclick="location.reload()">Tải lại trang</button>
            </div>
        `;
    }
}

// Initialize page-specific functionality
function initializePage(path) {
    switch (path) {
        case '/dashboard':
            if (typeof loadDashboardData === 'function') {
                loadDashboardData();
                // Auto refresh every 30 seconds
                window.dashboardInterval = setInterval(loadDashboardData, 30000);
            }
            break;
        case '/stations':
            // Initialize pagination first
            if (typeof initPagination === 'function') {
                initPagination();
            }
            if (typeof loadStationsData === 'function') {
                loadStationsData();
                // Setup search
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.addEventListener('input', filterStations);
                }
                // Auto refresh every 30 seconds
                window.stationsInterval = setInterval(loadStationsData, 30000);
            }
            break;
        case '/devices':
            // Initialize pagination first
            if (typeof initDevicesPagination === 'function') {
                initDevicesPagination();
            }
            if (typeof loadDevicesData === 'function') {
                loadDevicesData();
                // Auto refresh every 30 seconds
                window.devicesInterval = setInterval(loadDevicesData, 30000);
            }
            break;
        case '/logs':
            // Initialize pagination first
            if (typeof initLogsPagination === 'function') {
                initLogsPagination();
            }
            if (typeof loadApiStats === 'function') {
                loadApiStats();
                // Auto refresh every 30 seconds
                window.logsInterval = setInterval(loadApiStats, 30000);
            }
            break;
        case '/settings':
            // Initialize pagination first
            if (typeof initSettingsPagination === 'function') {
                initSettingsPagination();
            }
            if (typeof loadSettingsData === 'function') {
                loadSettingsData();
            }
            break;
        case '/queue':
            if (typeof loadQueueData === 'function') {
                loadQueueData();
                // Auto refresh every 10 seconds
                window.queueInterval = setInterval(loadQueueData, 10000);
            }
            break;
    }
}

// Update active menu item
function updateActiveMenu(path) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        const href = item.getAttribute('href');
        if (href === path || (path === '/' && href === '/dashboard')) {
            item.classList.add('active');
        }
    });
}

// Handle link clicks
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-link]');
    if (link) {
        e.preventDefault();
        const url = link.getAttribute('href');
        navigateTo(url);
    }
});

// Handle back/forward buttons
window.addEventListener('popstate', () => {
    navigateTo(window.location.pathname);
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    navigateTo(window.location.pathname);
});
