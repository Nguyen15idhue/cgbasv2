// Reports Page JavaScript

// Use window scope to avoid redeclaration errors in SPA
if (typeof window.reportFilters === 'undefined') {
    window.reportFilters = {
        period: 'day',
        startDate: '',
        endDate: ''
    };
}

// Load report summary data
async function loadReportSummary() {
    try {
        console.log('[Reports] Loading summary with filters:', window.reportFilters);
        
        const params = new URLSearchParams({
            period: window.reportFilters.period
        });
        
        if (window.reportFilters.startDate) {
            params.append('startDate', window.reportFilters.startDate);
        }
        if (window.reportFilters.endDate) {
            params.append('endDate', window.reportFilters.endDate);
        }
        
        const response = await fetch(`/api/reports/summary?${params}`);
        
        console.log('[Reports] Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            const errorText = await response.text();
            console.error('[Reports] Error response:', errorText);
            throw new Error(`Failed to load report (${response.status}): ${errorText.substring(0, 100)}`);
        }

        const data = await response.json();
        console.log('[Reports] Received data:', data);
        
        // Check for API errors
        if (!data.success) {
            throw new Error(data.message || 'Unknown error');
        }
        
        // Update summary stats
        updateSummaryStats(data.summary);
        
        // Render details table
        renderDetailsTable(data.details);
        
        // Render top endpoints
        renderTopEndpoints(data.topEndpoints);
        
        // Update period label
        const periodLabels = {
            'day': 'Ngày',
            'month': 'Tháng',
            'year': 'Năm'
        };
        document.getElementById('reportPeriodLabel').textContent = 
            `Nhóm theo: ${periodLabels[window.reportFilters.period]}`;
        
    } catch (error) {
        console.error('Error loading report summary:', error);
        showError('Không thể tải báo cáo: ' + error.message);
    }
}

// Load device statistics
async function loadDeviceStats() {
    try {
        const params = new URLSearchParams();
        
        if (window.reportFilters.startDate) {
            params.append('startDate', window.reportFilters.startDate);
        }
        if (window.reportFilters.endDate) {
            params.append('endDate', window.reportFilters.endDate);
        }
        
        const response = await fetch(`/api/reports/by-device?${params}`);
        
        if (!response.ok) {
            throw new Error(`Failed to load device stats: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Unknown error');
        }
        
        renderDeviceStats(data.devices);
        
    } catch (error) {
        console.error('Error loading device stats:', error);
        const tbody = document.getElementById('deviceStatsBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        Không thể tải thống kê thiết bị
                    </td>
                </tr>
            `;
        }
    }
}

// Update summary statistics cards
function updateSummaryStats(summary) {
    const totalCallsEl = document.getElementById('totalCalls');
    const successCallsEl = document.getElementById('successCalls');
    const errorCallsEl = document.getElementById('errorCalls');
    const avgDurationEl = document.getElementById('avgDuration');
    
    if (totalCallsEl) totalCallsEl.textContent = formatNumber(summary.total_calls || 0);
    if (successCallsEl) successCallsEl.textContent = formatNumber(summary.total_success || 0);
    if (errorCallsEl) errorCallsEl.textContent = formatNumber(summary.total_errors || 0);
    if (avgDurationEl) avgDurationEl.textContent = `${summary.avg_duration || 0} ms`;
}

// Render details table
function renderDetailsTable(details) {
    const tbody = document.getElementById('reportTableBody');
    
    if (!details || details.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Không có dữ liệu trong khoảng thời gian này</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = details.map(item => {
        const successRate = item.total_calls > 0 
            ? ((item.success_calls / item.total_calls) * 100).toFixed(1)
            : 0;
        
        // Format date theo period
        const formattedDate = formatPeriodDate(item.date, window.reportFilters.period);
        
        return `
            <tr>
                <td><strong>${formattedDate}</strong></td>
                <td class="text-center"><span class="number-large">${formatNumber(item.total_calls)}</span></td>
                <td class="text-center">
                    <span class="badge bg-success">${formatNumber(item.success_calls)}</span>
                    <small class="text-muted d-block mt-1">${successRate}%</small>
                </td>
                <td class="text-center">
                    <span class="badge bg-danger">${formatNumber(item.error_calls)}</span>
                </td>
                <td class="text-center">${item.unique_endpoints || 0}</td>
                <td class="text-center">${item.avg_duration_ms || 0}</td>
                <td class="datetime-display">${formatDateTime(item.first_call)}</td>
                <td class="datetime-display">${formatDateTime(item.last_call)}</td>
            </tr>
        `;
    }).join('');
}

// Render top endpoints
function renderTopEndpoints(endpoints) {
    const tbody = document.getElementById('topEndpointsBody');
    
    if (!endpoints || endpoints.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Không có dữ liệu</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = endpoints.map((item, index) => {
        return `
            <tr>
                <td><strong>#${index + 1}</strong></td>
                <td><span class="method-badge method-${item.method}">${escapeHtml(item.method)}</span></td>
                <td><code>${escapeHtml(item.endpoint)}</code></td>
                <td class="text-center"><span class="number-large">${formatNumber(item.count)}</span></td>
                <td class="text-center">${item.avg_duration || 0}</td>
            </tr>
        `;
    }).join('');
}

// Render device statistics
function renderDeviceStats(devices) {
    const tbody = document.getElementById('deviceStatsBody');
    
    if (!devices || devices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Không có dữ liệu thiết bị</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = devices.map(item => {
        const deviceName = item.device_name || '<em class="text-muted">Không rõ</em>';
        const deviceId = item.deviceid || 'N/A';
        
        return `
            <tr>
                <td><code>${escapeHtml(deviceId)}</code></td>
                <td>${deviceName}</td>
                <td class="text-center"><span class="number-large">${formatNumber(item.total_calls)}</span></td>
                <td class="text-center"><span class="badge bg-success">${formatNumber(item.success_calls)}</span></td>
                <td class="text-center"><span class="badge bg-danger">${formatNumber(item.error_calls)}</span></td>
                <td class="datetime-display">${formatDateTime(item.last_call)}</td>
            </tr>
        `;
    }).join('');
}

// Setup filter listeners
function setupFilters() {
    const periodFilter = document.getElementById('periodFilter');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const applyButton = document.getElementById('applyFilter');
    const resetButton = document.getElementById('resetFilter');
    const exportButton = document.getElementById('exportData');
    
    if (periodFilter) {
        periodFilter.addEventListener('change', (e) => {
            window.reportFilters.period = e.target.value;
        });
    }
    
    if (startDate) {
        startDate.addEventListener('change', (e) => {
            window.reportFilters.startDate = e.target.value;
        });
    }
    
    if (endDate) {
        endDate.addEventListener('change', (e) => {
            window.reportFilters.endDate = e.target.value;
        });
    }
    
    if (applyButton) {
        applyButton.addEventListener('click', () => {
            loadReportData();
        });
    }
    
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            window.reportFilters = {
                period: 'day',
                startDate: '',
                endDate: ''
            };
            document.getElementById('periodFilter').value = 'day';
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';
            loadReportData();
        });
    }
    
    if (exportButton) {
        exportButton.addEventListener('click', exportToCSV);
    }
}

// Load all report data
function loadReportData() {
    loadReportSummary();
    loadDeviceStats();
}

// Export data to CSV
function exportToCSV() {
    alert('Chức năng xuất CSV đang được phát triển');
    // TODO: Implement CSV export functionality
}

// Format number with thousand separators
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format date time
function formatDateTime(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format date theo period (day/month/year)
function formatPeriodDate(dateString, period) {
    if (!dateString) return '—';
    
    // Nếu là năm thì trả về luôn
    if (period === 'year') {
        return `Năm ${dateString}`;
    }
    
    // Nếu là tháng (format: YYYY-MM)
    if (period === 'month') {
        const [year, month] = dateString.split('-');
        const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
                           'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
        return `${monthNames[parseInt(month) - 1]}, ${year}`;
    }
    
    // Nếu là ngày (format: YYYY-MM-DD hoặc ISO date)
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const weekday = date.toLocaleDateString('vi-VN', { weekday: 'short' });
    
    return `${weekday}, ${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show error message
function showError(message) {
    const tbody = document.getElementById('reportTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;
    }
}

// Initialize page
function initReportsPage() {
    console.log('[Reports] Initializing page...');
    
    // Set default date range (last 7 days)
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    const endDateInput = document.getElementById('endDate');
    const startDateInput = document.getElementById('startDate');
    
    if (endDateInput) {
        endDateInput.value = today.toISOString().split('T')[0];
        window.reportFilters.endDate = endDateInput.value;
    }
    
    if (startDateInput) {
        startDateInput.value = lastWeek.toISOString().split('T')[0];
        window.reportFilters.startDate = startDateInput.value;
    }
    
    // Setup filters
    setupFilters();
    
    // Load initial data
    loadReportData();
    
    console.log('[Reports] Page initialized');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReportsPage);
} else {
    initReportsPage();
}
