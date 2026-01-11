/**
 * Component Loader
 * Dynamically loads HTML components into pages
 */

const ComponentLoader = {
    // Cache loaded components
    cache: {},

    // Component paths
    paths: {
        header: '/components/header.html',
        navigation: '/components/navigation.html',
        footer: '/components/footer.html',
        loader: '/components/loader.html'
    },

    /**
     * Load a component from file
     */
    async loadComponent(name) {
        // Return from cache if available
        if (this.cache[name]) {
            return this.cache[name];
        }

        const path = this.paths[name];
        if (!path) {
            throw new Error(`Component "${name}" not found`);
        }

        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load component: ${response.statusText}`);
            }

            const html = await response.text();
            this.cache[name] = html;
            return html;
        } catch (error) {
            console.error(`Error loading component "${name}":`, error);
            return '';
        }
    },

    /**
     * Insert component into target element
     */
    async insertComponent(name, targetSelector) {
        const target = document.querySelector(targetSelector);
        if (!target) {
            console.error(`Target element "${targetSelector}" not found`);
            return false;
        }

        const html = await this.loadComponent(name);
        target.innerHTML = html;
        return true;
    },

    /**
     * Load all components in page
     */
    async loadAll() {
        const promises = [];

        // Load header
        const headerTarget = document.getElementById('headerContainer');
        if (headerTarget) {
            promises.push(this.insertComponent('header', '#headerContainer'));
        }

        // Load navigation
        const navTarget = document.getElementById('navigationContainer');
        if (navTarget) {
            promises.push(this.insertComponent('navigation', '#navigationContainer'));
        }

        // Load footer
        const footerTarget = document.getElementById('footerContainer');
        if (footerTarget) {
            promises.push(this.insertComponent('footer', '#footerContainer'));
        }

        // Load loader
        const loaderTarget = document.getElementById('loaderContainer');
        if (loaderTarget) {
            promises.push(this.insertComponent('loader', '#loaderContainer'));
        }

        await Promise.all(promises);
        
        // Initialize components after loading
        this.initializeComponents();
    },

    /**
     * Initialize component functionality
     */
    initializeComponents() {
        this.initNavigation();
        this.initHeader();
        this.initFooter();
    },

    /**
     * Initialize navigation
     */
    initNavigation() {
        const currentPage = this.getCurrentPage();
        const navLinks = document.querySelectorAll('.nav-link');

        // Set active state
        navLinks.forEach(link => {
            const page = link.getAttribute('data-page');
            if (page === currentPage) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Update system uptime
        this.updateSystemUptime();
        setInterval(() => this.updateSystemUptime(), 60000); // Update every minute
    },

    /**
     * Initialize header
     */
    initHeader() {
        const currentPage = this.getCurrentPage();
        const pageTitle = document.getElementById('pageTitle');

        // Page titles
        const titles = {
            dashboard: 'Dashboard',
            stations: 'Quản lý Trạm',
            devices: 'Thiết bị eWelink',
            queue: 'Hàng đợi Phục hồi',
            logs: 'Lịch sử & Logs',
            settings: 'Cài đặt'
        };

        if (pageTitle) {
            pageTitle.textContent = titles[currentPage] || 'CGBAS System';
        }

        // Initialize dropdowns
        this.initDropdowns();

        // Initialize search
        this.initSearch();

        // Initialize notifications
        this.initNotifications();

        // Initialize user profile
        this.initUserProfile();

        // Initialize logout
        this.initLogout();
    },

    /**
     * Initialize footer
     */
    initFooter() {
        // Add any footer-specific initialization here
    },

    /**
     * Get current page name from URL
     */
    getCurrentPage() {
        const path = window.location.pathname;
        const match = path.match(/\/views\/([^.]+)\.html/);
        return match ? match[1] : 'dashboard';
    },

    /**
     * Initialize dropdowns
     */
    initDropdowns() {
        // Notification dropdown
        const btnNotifications = document.getElementById('btnNotifications');
        const notificationDropdown = document.getElementById('notificationDropdown');

        if (btnNotifications && notificationDropdown) {
            btnNotifications.addEventListener('click', (e) => {
                e.stopPropagation();
                notificationDropdown.classList.toggle('active');
                
                // Close profile dropdown
                const profileDropdown = document.getElementById('profileDropdown');
                if (profileDropdown) {
                    profileDropdown.classList.remove('active');
                }
            });
        }

        // Profile dropdown
        const btnProfile = document.getElementById('btnProfile');
        const profileDropdown = document.getElementById('profileDropdown');

        if (btnProfile && profileDropdown) {
            btnProfile.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('active');
                
                // Close notification dropdown
                if (notificationDropdown) {
                    notificationDropdown.classList.remove('active');
                }
            });
        }

        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            if (notificationDropdown) {
                notificationDropdown.classList.remove('active');
            }
            if (profileDropdown) {
                profileDropdown.classList.remove('active');
            }
        });
    },

    /**
     * Initialize global search
     */
    initSearch() {
        const searchInput = document.getElementById('globalSearch');
        if (!searchInput) return;

        searchInput.addEventListener('input', Helpers.debounce((e) => {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                this.performSearch(query);
            }
        }, 300));
    },

    /**
     * Perform global search
     */
    async performSearch(query) {
        // Implement global search logic here
        console.log('Searching for:', query);
        // You can search across stations, devices, logs, etc.
    },

    /**
     * Initialize notifications
     */
    async initNotifications() {
        try {
            // Fetch notifications from server
            // const notifications = await API.getNotifications();
            
            // For now, use dummy data
            this.updateNotificationBadge(0);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }

        // Mark all as read button
        const btnMarkAllRead = document.getElementById('btnMarkAllRead');
        if (btnMarkAllRead) {
            btnMarkAllRead.addEventListener('click', () => {
                this.markAllNotificationsRead();
            });
        }
    },

    /**
     * Update notification badge
     */
    updateNotificationBadge(count) {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    },

    /**
     * Mark all notifications as read
     */
    async markAllNotificationsRead() {
        try {
            // await API.markNotificationsRead();
            this.updateNotificationBadge(0);
            Helpers.showToast('Đã đánh dấu tất cả là đã đọc', 'success');
        } catch (error) {
            console.error('Failed to mark notifications as read:', error);
            Helpers.showToast('Có lỗi xảy ra', 'error');
        }
    },

    /**
     * Initialize user profile
     */
    initUserProfile() {
        const userName = document.getElementById('userName');
        const userRole = document.getElementById('userRole');

        // Get user info from localStorage or API
        const user = Helpers.storage.get('user', { username: 'Admin', role: 'Administrator' });

        if (userName) userName.textContent = user.username;
        if (userRole) userRole.textContent = user.role;
    },

    /**
     * Initialize logout functionality
     */
    initLogout() {
        const btnLogout = document.getElementById('btnLogout');
        if (!btnLogout) return;

        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();

            const confirmed = await Helpers.confirm(
                'Xác nhận đăng xuất',
                'Bạn có chắc muốn đăng xuất?',
                'Đăng xuất',
                'Hủy'
            );

            if (confirmed) {
                try {
                    await API.auth.logout();
                    Helpers.storage.remove('user');
                    window.location.href = '/views/login.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    Helpers.showToast('Có lỗi xảy ra khi đăng xuất', 'error');
                }
            }
        });
    },

    /**
     * Update system uptime
     */
    updateSystemUptime() {
        const uptimeElement = document.getElementById('systemUptime');
        if (!uptimeElement) return;

        // Get uptime from server or calculate from app start
        const startTime = Helpers.storage.get('appStartTime');
        if (!startTime) {
            Helpers.storage.set('appStartTime', Date.now());
            uptimeElement.textContent = '0 phút';
            return;
        }

        const uptime = Date.now() - startTime;
        const minutes = Math.floor(uptime / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            uptimeElement.textContent = `${days} ngày`;
        } else if (hours > 0) {
            uptimeElement.textContent = `${hours} giờ`;
        } else {
            uptimeElement.textContent = `${minutes} phút`;
        }
    }
};

// Export
window.ComponentLoader = ComponentLoader;

// Auto-load components when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await ComponentLoader.loadAll();
    });
} else {
    ComponentLoader.loadAll();
}
