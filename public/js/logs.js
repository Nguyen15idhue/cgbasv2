// Logs Page JavaScript

// Load logs data
async function loadApiStats() {
    try {
        const response = await fetch('/api/ewelink/api-stats');
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load logs');
        }

        const data = await response.json();
        
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
    } catch (error) {
        console.error('Error loading logs:', error);
        document.getElementById('logsTableBody').innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    Không thể tải nhật ký
                </td>
            </tr>
        `;
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

    tbody.innerHTML = logs.map(log => `
        <tr>
            <td>${new Date(log.created_at).toLocaleString('vi-VN')}</td>
            <td><code>${log.endpoint}</code></td>
            <td><code>${log.deviceid || 'N/A'}</code></td>
            <td>${log.outlet !== null ? log.outlet : 'N/A'}</td>
            <td>${log.action || 'N/A'}</td>
            <td>
                <span class="badge ${log.response_status === 'SUCCESS' ? 'bg-success' : 'bg-danger'}">
                    ${log.response_status}
                </span>
            </td>
        </tr>
    `).join('');
}
