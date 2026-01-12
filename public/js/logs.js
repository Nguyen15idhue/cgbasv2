// Logs Page JavaScript

// Use window scope to avoid redeclaration errors in SPA
if (typeof window.logsCurrentPage === 'undefined') {
    window.logsCurrentPage = 1;
    window.logsCurrentLimit = 20;
    window.logsPagination = null;
}

// Initialize pagination
function initLogsPagination() {
    console.log('[Logs] Initializing pagination...');
    const container = document.getElementById('logsPagination');
    if (!container) {
        console.error('[Logs] Pagination container not found!');
        return;
    }
    window.logsPagination = new Pagination('logsPagination', {
        limit: window.logsCurrentLimit,
        onPageChange: (page, limit) => {
            console.log('[Logs] Page changed:', page, limit);
            window.logsCurrentPage = page;
            window.logsCurrentLimit = limit;
            loadApiStats();
        }
    });
    console.log('[Logs] Pagination initialized');
}

// Load logs data with pagination
async function loadApiStats() {
    try {
        console.log('[Logs] Loading data, page:', window.logsCurrentPage, 'limit:', window.logsCurrentLimit);
        const params = new URLSearchParams({
            page: window.logsCurrentPage,
            limit: window.logsCurrentLimit
        });
        
        const response = await fetch(`/api/ewelink/api-stats?${params}`);
        
        console.log('[Logs] Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            const errorText = await response.text();
            console.error('[Logs] Error response:', errorText);
            throw new Error(`Failed to load logs (${response.status}): ${errorText.substring(0, 100)}`);
        }

        const data = await response.json();
        console.log('[Logs] Received data:', data);
        
        // Check if elements exist (SPA might not have loaded yet)
        const totalCallsEl = document.getElementById('totalCalls');
        const logsTableBody = document.getElementById('logsTableBody');
        
        if (!totalCallsEl || !logsTableBody) {
            console.warn('Logs elements not found, retrying...');
            setTimeout(loadApiStats, 100);
            return;
        }
        
        // Update total calls
        totalCallsEl.textContent = data.summary.total_calls || 0;
        
        // Render logs table
        renderLogs(data.history || []);
        
        // Update pagination
        if (window.logsPagination && data.pagination) {
            window.logsPagination.update(data.pagination.page, data.pagination.totalPages, data.pagination.total);
        }
        
    } catch (error) {
        console.error('Error loading logs:', error);
        const tbody = document.getElementById('logsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        Không thể tải nhật ký: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
}

// Render logs table
function renderLogs(logs) {
    const tbody = document.getElementById('logsTableBody');
    
    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <i class="fas fa-info-circle"></i> Chưa có nhật ký nào
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logs.map(log => {
        // Parse payload to extract device info
        let deviceId = 'N/A';
        let deviceName = log.device_name || 'N/A';
        let outlet = 'N/A';
        let action = 'N/A';
        try {
            if (log.payload) {
                const payload = JSON.parse(log.payload);
                // Extract device ID
                deviceId = payload.deviceid || payload.id || 'N/A';
                
                // Extract outlet and action from nested params.switches array
                if (payload.params && payload.params.switches && payload.params.switches.length > 0) {
                    const sw = payload.params.switches[0];
                    outlet = sw.outlet !== undefined ? sw.outlet : 'N/A';
                    action = sw.switch || 'N/A';
                } else if (payload.switches && payload.switches.length > 0) {
                    // Fallback for direct switches array
                    const sw = payload.switches[0];
                    outlet = sw.outlet !== undefined ? sw.outlet : 'N/A';
                    action = sw.switch || 'N/A';
                } else if (payload.outlet !== undefined) {
                    // Direct outlet field
                    outlet = payload.outlet;
                    action = payload.switch || 'N/A';
                }
            }
        } catch (e) {
            console.error('Error parsing log payload:', e);
        }
        
        // Determine status from response_code
        const isSuccess = log.response_code >= 200 && log.response_code < 300;
        const statusBadge = isSuccess ? 'bg-success' : 'bg-danger';
        const statusText = isSuccess ? 'SUCCESS' : `ERROR ${log.response_code || ''}`;
        
        return `
            <tr>
                <td>${new Date(log.created_at).toLocaleString('vi-VN')}</td>
                <td><code>${log.endpoint || 'N/A'}</code></td>
                <td>
                    ${deviceName !== 'N/A' ? deviceName : `<code>${deviceId}</code>`}
                    ${deviceName !== 'N/A' && deviceId !== 'N/A' ? `<br><small class="text-muted">${deviceId}</small>` : ''}
                </td>
                <td>${outlet}</td>
                <td>${action}</td>
                <td>
                    <span class="badge ${statusBadge}">
                        ${statusText}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}
