// History Page JavaScript

// Use window scope to avoid redeclaration errors in SPA
if (typeof window.historyCurrentPage === 'undefined') {
    window.historyCurrentPage = 1;
    window.historyCurrentLimit = 20;
    window.historyPagination = null;
    window.historyStatusFilter = '';
}

// Initialize pagination
function initHistoryPagination() {
    console.log('[History] Initializing pagination...');
    const container = document.getElementById('historyPagination');
    if (!container) {
        console.error('[History] Pagination container not found!');
        return;
    }
    window.historyPagination = new Pagination('historyPagination', {
        limit: window.historyCurrentLimit,
        onPageChange: (page, limit) => {
            console.log('[History] Page changed:', page, limit);
            window.historyCurrentPage = page;
            window.historyCurrentLimit = limit;
            loadHistoryData();
        }
    });
    console.log('[History] Pagination initialized');
}

// Load history data with pagination and filters
async function loadHistoryData() {
    try {
        console.log('[History] Loading data, page:', window.historyCurrentPage, 'limit:', window.historyCurrentLimit);
        const params = new URLSearchParams({
            page: window.historyCurrentPage,
            limit: window.historyCurrentLimit
        });
        
        if (window.historyStatusFilter) {
            params.append('status', window.historyStatusFilter);
        }
        
        const response = await fetch(`/api/stations/recovery-history?${params}`);
        
        console.log('[History] Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            const errorText = await response.text();
            console.error('[History] Error response:', errorText);
            throw new Error(`Failed to load history (${response.status}): ${errorText.substring(0, 100)}`);
        }

        const data = await response.json();
        console.log('[History] Received data:', data);
        
        // Check for API errors
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Check if elements exist (SPA might not have loaded yet)
        const totalHistoryEl = document.getElementById('totalHistory');
        const successCountEl = document.getElementById('successCount');
        const failedCountEl = document.getElementById('failedCount');
        const avgDurationEl = document.getElementById('avgDuration');
        const historyTableBody = document.getElementById('historyTableBody');
        
        if (!totalHistoryEl || !historyTableBody) {
            console.warn('History elements not found, retrying...');
            setTimeout(loadHistoryData, 100);
            return;
        }
        
        // Update stats (with null checks)
        if (data.stats) {
            totalHistoryEl.textContent = data.stats.total || 0;
            successCountEl.textContent = data.stats.success || 0;
            failedCountEl.textContent = data.stats.failed || 0;
            avgDurationEl.textContent = data.stats.avgDuration || 0;
        }
        
        // Render history table
        renderHistory(data.history || []);
        
        // Update pagination
        console.log('[History] Pagination object:', window.historyPagination);
        console.log('[History] Pagination data:', data.pagination);
        
        if (window.historyPagination && data.pagination) {
            console.log('[History] Updating pagination...');
            window.historyPagination.update(data.pagination.page, data.pagination.totalPages, data.pagination.total);
        } else {
            console.warn('[History] Cannot update pagination:', {
                hasObject: !!window.historyPagination,
                hasData: !!data.pagination
            });
        }
        
    } catch (error) {
        console.error('Error loading history:', error);
        const tbody = document.getElementById('historyTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        Không thể tải lịch sử: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
}

// Render history table
function renderHistory(history) {
    const tbody = document.getElementById('historyTableBody');
    
    if (history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    <i class="fas fa-inbox"></i>
                    <p>Chưa có lịch sử phục hồi</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = history.map(item => {
        const statusBadge = item.status === 'SUCCESS' 
            ? '<span class="badge bg-success">Thành công</span>'
            : '<span class="badge bg-danger">Thất bại</span>';
        
        const failureReason = item.failure_reason 
            ? `<span class="failure-reason" title="${escapeHtml(item.failure_reason)}">${escapeHtml(item.failure_reason)}</span>`
            : '<span class="text-muted">—</span>';
        
        const stationInfo = item.station_name 
            ? `<div><strong>${escapeHtml(item.station_name)}</strong></div><div class="text-muted small">${escapeHtml(item.station_id)}</div>`
            : `<div class="text-muted">${escapeHtml(item.station_id)}</div>`;
        
        const deviceInfo = item.device_id 
            ? `<div class="text-muted small">${escapeHtml(item.device_id)}</div>`
            : '<span class="text-muted">—</span>';
        
        return `
            <tr>
                <td>${formatDateTime(item.completed_at)}</td>
                <td>${stationInfo}</td>
                <td>${deviceInfo}</td>
                <td>${statusBadge}</td>
                <td class="text-center">${item.retry_count || 0}</td>
                <td class="text-center">${item.total_duration_minutes || 0}</td>
                <td>${failureReason}</td>
            </tr>
        `;
    }).join('');
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
        minute: '2-digit',
        second: '2-digit'
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Setup filter listeners
function setupFilters() {
    const statusFilter = document.getElementById('statusFilter');
    
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            window.historyStatusFilter = e.target.value;
            window.historyCurrentPage = 1; // Reset to page 1
            loadHistoryData();
        });
    }
}

// Initialize page
function initHistoryPage() {
    console.log('[History] Initializing page...');
    
    // Setup filters
    setupFilters();
    
    // Initialize pagination
    initHistoryPagination();
    
    // Load initial data
    loadHistoryData();
    
    // Setup auto-refresh every 30 seconds
    if (window.historyInterval) {
        clearInterval(window.historyInterval);
    }
    window.historyInterval = setInterval(loadHistoryData, 30000);
    
    console.log('[History] Page initialized');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHistoryPage);
} else {
    initHistoryPage();
}
