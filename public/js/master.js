// Master Layout JavaScript

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const topbar = document.querySelector('.topbar');
    const mainContent = document.querySelector('.main-content');
    const btnToggle = document.querySelector('.btn-toggle-sidebar');
    const btnLogout = document.querySelector('.btn-logout');

    // Toggle Sidebar
    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            topbar.classList.toggle('full-width');
            mainContent.classList.toggle('full-width');

            // Save state to localStorage
            const isCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', isCollapsed);
        });
    }

    // Restore sidebar state from localStorage
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed');
    if (sidebarCollapsed === 'true') {
        sidebar.classList.add('collapsed');
        topbar.classList.add('full-width');
        mainContent.classList.add('full-width');
    }

    // Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            const result = await Swal.fire({
                title: 'Xác nhận đăng xuất',
                text: 'Bạn có chắc muốn đăng xuất?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Đăng xuất',
                cancelButtonText: 'Hủy',
                confirmButtonColor: '#dc3545',
                cancelButtonColor: '#6c757d'
            });

            if (result.isConfirmed) {
                try {
                    const response = await fetch('/api/auth/logout', { 
                        method: 'POST'
                    });
                    if (response.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Đã đăng xuất',
                            text: 'Đang chuyển về trang đăng nhập...',
                            timer: 1500,
                            showConfirmButton: false
                        }).then(() => {
                            window.location.href = '/login';
                        });
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Lỗi',
                        text: 'Không thể đăng xuất. Vui lòng thử lại.'
                    });
                }
            }
        });
    }

    // Active menu item
    const currentPath = window.location.pathname;
    document.querySelectorAll('.menu-item').forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPath || (currentPath.startsWith(href) && href !== '/')) {
            item.classList.add('active');
        }
    });

    // Mobile: Close sidebar when clicking outside
    if (window.innerWidth <= 768) {
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !btnToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        });
    }
});

// Utility: Show loading spinner
function showLoading(message = 'Đang tải...') {
    Swal.fire({
        title: message,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

// Utility: Hide loading spinner
function hideLoading() {
    Swal.close();
}

// Utility: Show success message
function showSuccess(message) {
    Swal.fire({
        icon: 'success',
        title: 'Thành công',
        text: message,
        timer: 2000,
        showConfirmButton: false
    });
}

// Utility: Show error message
function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: message
    });
}

// Utility: Confirm dialog
async function confirmAction(message) {
    const result = await Swal.fire({
        title: 'Xác nhận',
        text: message,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Xác nhận',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#667eea',
        cancelButtonColor: '#6c757d'
    });
    return result.isConfirmed;
}
