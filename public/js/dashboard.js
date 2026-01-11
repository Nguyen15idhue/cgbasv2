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
        document.getElementById('onlineStations').textContent = data.onlineStations || 0;
        document.getElementById('offlineStations').textContent = data.offlineStations || 0;
        document.getElementById('pendingJobs').textContent = data.pendingJobs || 0;
        document.getElementById('recoveredToday').textContent = data.recoveredToday || 0;
        document.getElementById('queueBadge').textContent = data.pendingJobs || 0;

        // Update user info
        if (data.user) {
            document.getElementById('userName').textContent = data.user.username || 'Admin';
            const avatar = data.user.username ? data.user.username.charAt(0).toUpperCase() : 'A';
            document.querySelector('.user-avatar').textContent = avatar;
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Auto refresh every 30 seconds
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    setInterval(loadDashboardData, 30000);
});
