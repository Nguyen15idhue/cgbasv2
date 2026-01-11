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

