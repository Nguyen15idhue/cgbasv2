// Stations Page JavaScript

let allStations = [];
let filteredStations = [];

// Load stations data
async function loadStationsData() {
    try {
        showTableLoading();
        
        const response = await fetch('/api/stations/list');
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load stations');
        }

        const data = await response.json();
        allStations = data.stations || [];
        filteredStations = [...allStations];
        
        renderStationsTable();
    } catch (error) {
        console.error('Error loading stations:', error);
        showError('Không thể tải danh sách trạm');
    }
}

// Render stations table
function renderStationsTable() {
    const tbody = document.getElementById('stationsTableBody');
    if (!tbody) return;
    
    if (filteredStations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <h5>Không tìm thấy kết quả</h5>
                    <p class="text-muted">Thử thay đổi từ khóa tìm kiếm</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredStations.map(station => `
        <tr>
            <td>
                <div><strong>${station.stationName || 'N/A'}</strong></div>
                <small class="text-muted">${station.id}</small>
            </td>
            <td>${station.identificationName || 'N/A'}</td>
            <td>
                <span class="badge ${station.connectStatus === 1 ? 'bg-success' : 'bg-danger'}">
                    ${station.connectStatus === 1 ? 'Online' : 'Offline'}
                </span>
            </td>
            <td>
                <span class="badge bg-primary">G:${station.sat_G || 0}</span>
                <span class="badge bg-info">R:${station.sat_R || 0}</span>
                <span class="badge bg-warning">C:${station.sat_C || 0}</span>
                <span class="badge bg-success">E:${station.sat_E || 0}</span>
            </td>
            <td>${station.delay || 'N/A'}</td>
            <td>
                ${station.ewelink_device_id 
                    ? `<code>${station.ewelink_device_id}</code>`
                    : '<span class="text-muted">Chưa liên kết</span>'
                }
            </td>
            <td>
                ${station.connectStatus === 0 && station.ewelink_device_id
                    ? `<button class="btn btn-primary btn-sm" onclick="recoverStation('${station.id}', '${station.ewelink_device_id}')">
                        <i class="fas fa-sync"></i> Phục hồi
                       </button>`
                    : '<span class="text-muted">-</span>'
                }
            </td>
        </tr>
    `).join('');
}

// Show table loading
function showTableLoading() {
    const tbody = document.getElementById('stationsTableBody');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-5">
                <i class="fas fa-spinner fa-spin fa-3x text-primary"></i>
                <p class="mt-3">Đang tải dữ liệu...</p>
            </td>
        </tr>
    `;
}

// Show error message
function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: message
    });
}

// Filter stations (Realtime)
function filterStations() {
    const keyword = document.getElementById('searchInput').value.toLowerCase();
    
    if (!keyword.trim()) {
        filteredStations = [...allStations];
    } else {
        filteredStations = allStations.filter(station => {
            return (
                (station.stationName && station.stationName.toLowerCase().includes(keyword)) ||
                (station.id && station.id.toLowerCase().includes(keyword)) ||
                (station.identificationName && station.identificationName.toLowerCase().includes(keyword))
            );
        });
    }
    
    renderStationsTable();
}

// Recover station
async function recoverStation(stationId, deviceId) {
    const confirmed = await confirmAction(`Bạn có chắc muốn kích hoạt phục hồi trạm ${stationId}?`);
    if (!confirmed) return;

    showLoading('Đang gửi lệnh phục hồi...');

    try {
        const response = await fetch('/api/stations/recover', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ stationId, deviceId })
        });

        const data = await response.json();

        hideLoading();

        if (response.ok) {
            showSuccess('Đã thêm vào hàng đợi phục hồi');
            setTimeout(() => loadStationsData(), 1000);
        } else {
            showError(data.message || 'Không thể thực hiện lệnh');
        }
    } catch (error) {
        hideLoading();
        showError('Lỗi kết nối đến server');
    }
}

// Setup search box
document.addEventListener('DOMContentLoaded', () => {
    const searchBox = document.getElementById('searchInput');
    if (searchBox) {
        searchBox.addEventListener('input', filterStations);
    }
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', filterStations);
    }
    
    // Load initial data
    loadStationsData();
    
    // Auto refresh every 30 seconds
    setInterval(loadStationsData, 30000);
});
