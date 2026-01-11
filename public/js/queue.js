// Queue Page JavaScript

// Status badge mapping
const statusBadges = {
    'PENDING': '<span class="badge-status badge-pending">Chờ xử lý</span>',
    'RUNNING': '<span class="badge-status badge-running">Đang chạy</span>',
    'CHECKING': '<span class="badge-status badge-checking">Kiểm tra</span>',
    'SUCCESS': '<span class="badge-status badge-success">Thành công</span>',
    'FAILED': '<span class="badge-status badge-failed">Thất bại</span>'
};

// Load queue data
async function loadQueueData() {
    try {
        const response = await fetch('/api/queue/jobs');
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load queue data');
        }

        const data = await response.json();
        const tbody = document.getElementById('queueTableBody');
        
        if (!data.jobs || data.jobs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <h5>Không có công việc nào</h5>
                            <p>Hệ thống hiện không có trạm nào đang trong hàng đợi phục hồi</p>
                        </div>
                    </td>
                </tr>
            `;
            document.getElementById('queueBadge').textContent = '0';
            return;
        }

        tbody.innerHTML = data.jobs.map(job => `
            <tr>
                <td><strong>${job.station_id}</strong></td>
                <td><code>${job.device_id || 'N/A'}</code></td>
                <td>${statusBadges[job.status] || job.status}</td>
                <td><span class="badge bg-secondary">${job.retry_index || 0}</span></td>
                <td>${job.next_run_time ? formatDateTime(job.next_run_time) : 'N/A'}</td>
                <td>${formatDateTime(job.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-danger btn-action" onclick="cancelJob('${job.station_id}')">
                        <i class="fas fa-times"></i> Hủy
                    </button>
                </td>
            </tr>
        `).join('');

        document.getElementById('queueBadge').textContent = data.jobs.length;
    } catch (error) {
        console.error('Error loading queue data:', error);
        showError('Không thể tải dữ liệu hàng đợi');
    }
}

// Cancel job
async function cancelJob(stationId) {
    const confirmed = await confirmAction(`Bạn có chắc muốn hủy công việc phục hồi cho trạm ${stationId}?`);
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/queue/jobs/${stationId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to cancel job');

        showSuccess('Đã hủy công việc thành công');
        loadQueueData();
    } catch (error) {
        showError('Không thể hủy công việc');
    }
}

// Format datetime
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Auto refresh every 10 seconds
document.addEventListener('DOMContentLoaded', () => {
    loadQueueData();
    setInterval(loadQueueData, 10000);
});
