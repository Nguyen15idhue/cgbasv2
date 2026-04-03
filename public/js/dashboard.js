// Dashboard Page JavaScript

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard/stats');
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load data');
        }

        const data = await response.json();
        
        // Update statistics
        const onlineEl = document.getElementById('onlineStations');
        const offlineEl = document.getElementById('offlineStations');
        const pendingEl = document.getElementById('pendingJobs');
        const recoveredEl = document.getElementById('recoveredToday');
        const queueBadgeEl = document.getElementById('queueBadge');
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.querySelector('.user-avatar');
        
        if (onlineEl) onlineEl.textContent = data.onlineStations || 0;
        if (offlineEl) offlineEl.textContent = data.offlineStations || 0;
        if (pendingEl) pendingEl.textContent = data.pendingJobs || 0;
        if (recoveredEl) recoveredEl.textContent = data.recoveredToday || 0;
        if (queueBadgeEl) queueBadgeEl.textContent = data.pendingJobs || 0;

        // Update user info
        if (data.user) {
            if (userNameEl) userNameEl.textContent = data.user.username || 'Admin';
            const avatar = data.user.username ? data.user.username.charAt(0).toUpperCase() : 'A';
            if (userAvatarEl) userAvatarEl.textContent = avatar;
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Load recent recovery history
async function loadRecentActivities() {
    try {
        const response = await fetch('/api/stations/recovery-history/recent');
        
        if (!response.ok) {
            throw new Error('Failed to load recent activities');
        }

        const result = await response.json();
        const container = document.getElementById('recentActivities');
        
        if (!container) return;

        if (!result.data || result.data.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-inbox fa-2x mb-3"></i>
                    <p>Không có hoạt động gần đây</p>
                </div>
            `;
            return;
        }

        let html = '<ul class="list-group list-group-flush">';
        
        result.data.forEach(item => {
            const statusClass = item.status === 'SUCCESS' ? 'success' : 
                               item.status === 'FAILED' ? 'danger' : 'warning';
            const statusText = item.status === 'SUCCESS' ? 'Thành công' : 
                              item.status === 'FAILED' ? 'Thất bại' : 'Đang chờ';
            const time = item.completed_at ? new Date(item.completed_at).toLocaleString('vi-VN') : 
                        (item.started_at ? new Date(item.started_at).toLocaleString('vi-VN') : '-');
            
            html += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${item.station_name || item.station_id}</strong>
                        <br><small class="text-muted">${time}</small>
                    </div>
                    <span class="badge bg-${statusClass}">${statusText}</span>
                </li>
            `;
        });
        
        html += '</ul>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading recent activities:', error);
        const container = document.getElementById('recentActivities');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4 text-danger">
                    <p>Lỗi tải dữ liệu</p>
                </div>
            `;
        }
    }
}

