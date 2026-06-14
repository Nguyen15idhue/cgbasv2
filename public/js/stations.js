// Stations Page JavaScript

let currentPage = 1;
let currentLimit = 20;
let searchKeyword = '';
let pagination = null;

// Initialize pagination
function initPagination() {
    pagination = new Pagination('stationsPagination', {
        limit: currentLimit,
        onPageChange: (page, limit) => {
            currentPage = page;
            currentLimit = limit;
            loadStationsData();
        }
    });
}

// Load stations data with pagination
async function loadStationsData() {
    try {
        showTableLoading();
        
        const sourceFilter = document.getElementById('sourceFilter')?.value || '';
        
        const params = new URLSearchParams({
            page: currentPage,
            limit: currentLimit,
            search: searchKeyword,
            source: sourceFilter
        });
        
        const response = await fetch(`/api/stations/list?${params}`);
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load stations');
        }

        const data = await response.json();
        
        renderStationsTable(data.stations || []);
        
        // Update pagination
        if (pagination) {
            pagination.update(data.page, data.totalPages, data.total);
        }
        
        // Update total count
        const totalEl = document.getElementById('totalStations');
        if (totalEl) {
            totalEl.textContent = data.total;
        }
        
    } catch (error) {
        console.error('Error loading stations:', error);
        showError('Không thể tải danh sách trạm');
    }
}

// Render stations table
function renderStationsTable(stations) {
    const tbody = document.getElementById('stationsTableBody');
    if (!tbody) return;
    
    if (stations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-5">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <h5>Không tìm thấy kết quả</h5>
                    <p class="text-muted">Thử thay đổi từ khóa tìm kiếm</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = stations.map(station => {
        const sourceBadge = station.status_source === 'ntrip'
            ? '<span class="badge bg-warning"><i class="fas fa-satellite-dish"></i> NTRIP</span>'
            : '<span class="badge bg-info"><i class="fas fa-server"></i> CGBAS</span>';
        
        const switchButton = station.status_source === 'ntrip'
            ? `<button class="btn btn-info btn-sm" onclick="switchToCgbas('${station.id}')" title="Chuyển sang CGBAS">
                <i class="fas fa-server"></i>
               </button>`
            : `<button class="btn btn-warning btn-sm" onclick="openNtripModal('${station.id}')" title="Chuyển sang NTRIP">
                <i class="fas fa-satellite-dish"></i>
               </button>`;
        
        return `
        <tr>
            <td>
                <div><strong>${station.stationName || 'N/A'}</strong></div>
                <small class="text-muted">${station.id}</small>
            </td>
            <td>${station.identificationName || 'N/A'}</td>
            <td>${sourceBadge}</td>
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
                <div class="btn-group">
                    ${switchButton}
                    ${station.connectStatus === 0 && station.ewelink_device_id
                        ? `<button class="btn btn-primary btn-sm" onclick="recoverStation('${station.id}', '${station.ewelink_device_id}')" title="Phục hồi">
                            <i class="fas fa-sync"></i>
                           </button>`
                        : ''
                    }
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

// Show table loading
function showTableLoading() {
    const tbody = document.getElementById('stationsTableBody');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center py-5">
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
    searchKeyword = keyword;
    currentPage = 1; // Reset to first page
    loadStationsData();
}

// Open NTRIP config modal
async function openNtripModal(stationId) {
    document.getElementById('ntripStationId').value = stationId;
    document.getElementById('ntripUrl').value = '';
    document.getElementById('ntripMountpoint').value = '';
    document.getElementById('ntripUser').value = '';
    document.getElementById('ntripPass').value = '';
    
    try {
        const response = await fetch(`/api/stations/${stationId}/ntrip-config`);
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                document.getElementById('ntripUrl').value = result.data.ntrip_url || '';
                document.getElementById('ntripMountpoint').value = result.data.mountpoint || '';
                document.getElementById('ntripUser').value = result.data.ntrip_user || '';
                document.getElementById('ntripPass').value = result.data.ntrip_pass || '';
            }
        }
    } catch (e) {}
    
    const modal = new bootstrap.Modal(document.getElementById('ntripConfigModal'));
    modal.show();
}

// Switch source (CGBAS <-> NTRIP)
async function switchSource(source) {
    const stationId = document.getElementById('ntripStationId').value;
    if (!stationId) return;
    
    let config = {};
    
    if (source === 'ntrip') {
        config = {
            ntrip_url: document.getElementById('ntripUrl').value,
            mountpoint: document.getElementById('ntripMountpoint').value,
            ntrip_user: document.getElementById('ntripUser').value,
            ntrip_pass: document.getElementById('ntripPass').value
        };
        
        if (!config.ntrip_url || !config.mountpoint) {
            Swal.fire('Lỗi', 'Vui lòng nhập NTRIP URL và Mountpoint', 'error');
            return;
        }
    }
    
    try {
        showLoading('Đang chuyển nguồn...');
        
        // Save NTRIP config if switching to ntrip
        if (source === 'ntrip') {
            const configResponse = await fetch(`/api/stations/${stationId}/ntrip-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            if (!configResponse.ok) {
                throw new Error('Không thể lưu cấu hình NTRIP');
            }
        }
        
        // Switch source
        const response = await fetch(`/api/stations/${stationId}/set-source`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source })
        });
        
        hideLoading();
        
        if (response.ok) {
            // Close modal if open
            const modal = bootstrap.Modal.getInstance(document.getElementById('ntripConfigModal'));
            if (modal) modal.hide();
            
            Swal.fire('Thành công', `Đã chuyển sang nguồn ${source.toUpperCase()}`, 'success');
            loadStationsData();
        } else {
            const data = await response.json();
            throw new Error(data.message || 'Không thể chuyển nguồn');
        }
    } catch (error) {
        hideLoading();
        Swal.fire('Lỗi', error.message, 'error');
    }
}

// Switch to CGBAS (quick action)
async function switchToCgbas(stationId) {
    const confirmed = await Swal.fire({
        title: 'Chuyển sang CGBAS?',
        text: 'Trạm sẽ dùng CGBAS API để lấy trạng thái',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Đồng ý',
        cancelButtonText: 'Hủy'
    }).then(r => r.isConfirmed);
    
    if (!confirmed) return;
    
    try {
        showLoading('Đang chuyển nguồn...');
        
        const response = await fetch(`/api/stations/${stationId}/set-source`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'cgbas' })
        });
        
        hideLoading();
        
        if (response.ok) {
            Swal.fire('Thành công', 'Đã chuyển sang nguồn CGBAS', 'success');
            loadStationsData();
        } else {
            const data = await response.json();
            throw new Error(data.message || 'Không thể chuyển nguồn');
        }
    } catch (error) {
        hideLoading();
        Swal.fire('Lỗi', error.message, 'error');
    }
}

// Recover station
async function recoverStation(stationId, deviceId) {
    const confirmed = await Swal.fire({
        title: 'Phục hồi trạm?',
        text: `Kích hoạt phục hồi trạm ${stationId}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Đồng ý',
        cancelButtonText: 'Hủy'
    }).then(r => r.isConfirmed);
    
    if (!confirmed) return;

    showLoading('Đang gửi lệnh phục hồi...');

    try {
        const response = await fetch('/api/stations/recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationId, deviceId })
        });

        const data = await response.json();
        hideLoading();

        if (response.ok) {
            Swal.fire('Thành công', 'Đã thêm vào hàng đợi phục hồi', 'success');
            setTimeout(() => loadStationsData(), 1000);
        } else {
            Swal.fire('Lỗi', data.message || 'Không thể thực hiện lệnh', 'error');
        }
    } catch (error) {
        hideLoading();
        Swal.fire('Lỗi', 'Lỗi kết nối đến server', 'error');
    }
}

// Loading helper
function showLoading(text) {
    Swal.fire({
        title: text,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });
}

function hideLoading() {
    Swal.close();
}
