/**
 * Helper Utilities
 * Common functions used across the application
 */

const Helpers = {
    /**
     * Format date to readable string
     */
    formatDate(date, format = 'full') {
        if (!date) return '--';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '--';

        const options = {
            full: {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            },
            short: {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            },
            time: {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }
        };

        return d.toLocaleString('vi-VN', options[format] || options.full);
    },

    /**
     * Format relative time (e.g., "5 phút trước")
     */
    formatRelativeTime(date) {
        if (!date) return '--';
        
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} giờ trước`;
        
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `${diffDays} ngày trước`;
        
        const diffMonths = Math.floor(diffDays / 30);
        if (diffMonths < 12) return `${diffMonths} tháng trước`;
        
        const diffYears = Math.floor(diffMonths / 12);
        return `${diffYears} năm trước`;
    },

    /**
     * Format duration in minutes to readable string
     */
    formatDuration(minutes) {
        if (!minutes || minutes < 1) return '< 1 phút';
        
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        
        if (hours === 0) return `${mins} phút`;
        if (mins === 0) return `${hours} giờ`;
        return `${hours} giờ ${mins} phút`;
    },

    /**
     * Format number with thousand separator
     */
    formatNumber(num, decimals = 0) {
        if (typeof num !== 'number') return '0';
        return num.toLocaleString('vi-VN', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    /**
     * Format percentage
     */
    formatPercent(value, total, decimals = 1) {
        if (!total || total === 0) return '0%';
        const percent = (value / total) * 100;
        return `${percent.toFixed(decimals)}%`;
    },

    /**
     * Debounce function
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Copy to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Đã sao chép vào clipboard', 'success');
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            this.showToast('Không thể sao chép', 'error');
            return false;
        }
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            border-left: 4px solid ${colors[type]};
        `;

        toast.innerHTML = `
            <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 20px;"></i>
            <span style="color: #1f2937; font-size: 14px;">${message}</span>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Show loading indicator
     */
    showLoading(message = 'Đang tải...') {
        const loader = document.getElementById('appLoader');
        if (loader) {
            loader.classList.add('active');
            const text = loader.querySelector('.loader-text');
            if (text) text.textContent = message;
        }
    },

    /**
     * Hide loading indicator
     */
    hideLoading() {
        const loader = document.getElementById('appLoader');
        if (loader) {
            loader.classList.remove('active');
        }
    },

    /**
     * Confirm dialog with SweetAlert2
     */
    async confirm(title, text, confirmText = 'Xác nhận', cancelText = 'Hủy') {
        const result = await Swal.fire({
            title,
            text,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: cancelText,
            confirmButtonColor: '#667eea',
            cancelButtonColor: '#6c757d'
        });
        return result.isConfirmed;
    },

    /**
     * Success alert
     */
    async success(title, text = '') {
        return await Swal.fire({
            title,
            text,
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#10b981'
        });
    },

    /**
     * Error alert
     */
    async error(title, text = '') {
        return await Swal.fire({
            title,
            text,
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#ef4444'
        });
    },

    /**
     * Get status badge HTML
     */
    getStatusBadge(status, type = 'station') {
        const badges = {
            station: {
                1: '<span class="badge bg-success">Online</span>',
                2: '<span class="badge bg-warning">Cảnh báo</span>',
                3: '<span class="badge bg-danger">Offline</span>',
                default: '<span class="badge bg-secondary">Không xác định</span>'
            },
            recovery: {
                SUCCESS: '<span class="badge bg-success">Thành công</span>',
                FAILED: '<span class="badge bg-danger">Thất bại</span>',
                PENDING: '<span class="badge bg-warning">Đang xử lý</span>',
                default: '<span class="badge bg-secondary">Không xác định</span>'
            },
            device: {
                online: '<span class="badge bg-success">Online</span>',
                offline: '<span class="badge bg-danger">Offline</span>',
                default: '<span class="badge bg-secondary">Không xác định</span>'
            }
        };

        const badgeMap = badges[type] || badges.station;
        return badgeMap[status] || badgeMap.default;
    },

    /**
     * Sanitize HTML to prevent XSS
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    /**
     * Parse query string to object
     */
    parseQueryString(queryString) {
        const params = new URLSearchParams(queryString);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    },

    /**
     * Build query string from object
     */
    buildQueryString(params) {
        return new URLSearchParams(params).toString();
    },

    /**
     * Download data as file
     */
    downloadFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    },

    /**
     * Local storage with JSON support
     */
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('LocalStorage set error:', e);
                return false;
            }
        },

        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('LocalStorage get error:', e);
                return defaultValue;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error('LocalStorage remove error:', e);
                return false;
            }
        },

        clear() {
            try {
                localStorage.clear();
                return true;
            } catch (e) {
                console.error('LocalStorage clear error:', e);
                return false;
            }
        }
    }
};

// Add CSS animation for toast
if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Export
window.Helpers = Helpers;
