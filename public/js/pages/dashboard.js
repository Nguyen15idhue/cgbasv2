/**
 * Dashboard Page JavaScript
 * Handles dashboard data loading and visualization
 */

class DashboardPage {
    constructor() {
        this.refreshInterval = null;
        this.charts = {};
        this.init();
    }

    /**
     * Initialize dashboard
     */
    async init() {
        // Wait for components to load
        await this.waitForComponents();

        // Load initial data
        await this.loadDashboardData();

        // Initialize charts
        this.initCharts();

        // Setup event listeners
        this.setupEventListeners();

        // Start auto-refresh
        this.startAutoRefresh();
    }

    /**
     * Wait for components to be loaded
     */
    async waitForComponents() {
        return new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (document.querySelector('.sidebar') && document.querySelector('.topbar')) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        try {
            Helpers.showLoading('Đang tải dữ liệu dashboard...');

            // Fetch data in parallel
            const [statsData, historyData, activityData] = await Promise.all([
                API.stations.getAllStatus(),
                API.stations.getRecoveryStats(),
                API.stations.getRecoveryHistory({ limit: 10 })
            ]);

            // Update stats cards
            this.updateStatsCards(statsData, historyData);

            // Update charts
            this.updateCharts(historyData);

            // Update activity table
            this.updateActivityTable(activityData);

            Helpers.hideLoading();
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            Helpers.hideLoading();
            Helpers.showToast('Không thể tải dữ liệu dashboard', 'error');
        }
    }

    /**
     * Update stats cards
     */
    updateStatsCards(statsData, historyData) {
        // Count stations by status
        const online = statsData.filter(s => s.connectStatus === 1).length;
        const offline = statsData.filter(s => s.connectStatus === 3).length;
        const warning = statsData.filter(s => s.connectStatus === 2).length;

        // Count active recovery jobs
        const recovering = statsData.filter(s => s.isRecovering).length;

        // Calculate success rate
        const successRate = historyData.successRate || 0;

        // Update online card
        const statOnline = document.querySelector('#statOnline .stat-value');
        if (statOnline) statOnline.textContent = online;

        // Update offline card
        const statOffline = document.querySelector('#statOffline .stat-value');
        if (statOffline) statOffline.textContent = offline;

        // Update recovering card
        const statRecovering = document.querySelector('#statRecovering .stat-value');
        if (statRecovering) statRecovering.textContent = recovering;

        // Update success rate card
        const statSuccess = document.querySelector('#statSuccess .stat-value');
        if (statSuccess) statSuccess.textContent = `${successRate.toFixed(1)}%`;
    }

    /**
     * Initialize charts
     */
    initCharts() {
        // Recovery Trend Chart (Line)
        const trendCtx = document.getElementById('recoveryTrendChart');
        if (trendCtx) {
            this.charts.trend = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Thành công',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Thất bại',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
        }

        // Status Pie Chart
        const pieCtx = document.getElementById('statusPieChart');
        if (pieCtx) {
            this.charts.status = new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Online', 'Offline', 'Cảnh báo'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: [
                            '#10b981',
                            '#ef4444',
                            '#f59e0b'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                        }
                    }
                }
            });
        }
    }

    /**
     * Update charts with data
     */
    updateCharts(historyData) {
        // Update trend chart
        if (this.charts.trend && historyData.weeklyTrend) {
            const labels = historyData.weeklyTrend.map(d => d.date);
            const successData = historyData.weeklyTrend.map(d => d.success);
            const failedData = historyData.weeklyTrend.map(d => d.failed);

            this.charts.trend.data.labels = labels;
            this.charts.trend.data.datasets[0].data = successData;
            this.charts.trend.data.datasets[1].data = failedData;
            this.charts.trend.update();
        }

        // Update pie chart
        if (this.charts.status && historyData.statusDistribution) {
            const dist = historyData.statusDistribution;
            this.charts.status.data.datasets[0].data = [
                dist.online || 0,
                dist.offline || 0,
                dist.warning || 0
            ];
            this.charts.status.update();
        }
    }

    /**
     * Update activity table
     */
    updateActivityTable(activityData) {
        const tbody = document.getElementById('activityTableBody');
        if (!tbody) return;

        if (!activityData || !activityData.history || activityData.history.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">
                        <i class="fas fa-inbox"></i> Chưa có hoạt động nào
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = activityData.history.map(item => `
            <tr>
                <td>
                    <small>${Helpers.formatRelativeTime(item.created_at)}</small>
                </td>
                <td>
                    <strong>${Helpers.escapeHtml(item.station_name || item.station_id)}</strong>
                </td>
                <td>
                    <i class="fas fa-sync-alt"></i> Phục hồi tự động
                </td>
                <td>
                    ${Helpers.getStatusBadge(item.status, 'recovery')}
                </td>
                <td>
                    ${item.total_duration_minutes ? Helpers.formatDuration(item.total_duration_minutes) : '--'}
                </td>
            </tr>
        `).join('');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Refresh button
        const btnRefresh = document.getElementById('btnRefresh');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                this.loadDashboardData();
            });
        }

        // Listen to breakpoint changes
        window.addEventListener('breakpointChange', (e) => {
            // Adjust charts for mobile
            if (e.detail.to === 'mobile' || e.detail.to === 'tablet') {
                this.adjustChartsForMobile();
            }
        });
    }

    /**
     * Adjust charts for mobile view
     */
    adjustChartsForMobile() {
        if (this.charts.trend) {
            this.charts.trend.options.plugins.legend.display = false;
            this.charts.trend.update();
        }
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        // Refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadDashboardData();
        }, 30000);
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.dashboardPage = new DashboardPage();
    });
} else {
    window.dashboardPage = new DashboardPage();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.dashboardPage) {
        window.dashboardPage.stopAutoRefresh();
    }
});
