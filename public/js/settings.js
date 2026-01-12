// Settings Page JavaScript

// Use window scope to avoid redeclaration errors in SPA
window.settingsStations = window.settingsStations || [];
window.settingsDevices = window.settingsDevices || [];
window.settingsCurrentPage = window.settingsCurrentPage || 1;
window.settingsCurrentLimit = window.settingsCurrentLimit || 20;
window.settingsPagination = window.settingsPagination || null;

// Initialize pagination
function initSettingsPagination() {
    const container = document.getElementById('settingsPagination');
    if (!container) {
        console.warn('[Settings] Pagination container not found');
        return false;
    }
    
    if (!window.Pagination) {
        console.error('[Settings] Pagination class not loaded!');
        return false;
    }
    
    try {
        window.settingsPagination = new Pagination('settingsPagination', {
            limit: window.settingsCurrentLimit,
            onPageChange: (page, limit) => {
                window.settingsCurrentPage = page;
                window.settingsCurrentLimit = limit;
                loadSettings();
            }
        });
        console.log('[Settings] Pagination initialized:', window.settingsPagination);
        return true;
    } catch (err) {
        console.error('[Settings] Failed to create pagination:', err);
        return false;
    }
}

// Load data
async function loadSettings() {
    try {
        // Initialize pagination if not exists
        if (!window.settingsPagination) {
            initSettingsPagination();
        }

        // Load stations with pagination
        const params = new URLSearchParams({
            page: window.settingsCurrentPage,
            limit: window.settingsCurrentLimit
        });
        const stationsRes = await fetch(`/api/stations/list?${params}`);
        if (!stationsRes.ok) {
            const errorText = await stationsRes.text();
            console.error('Stations API Error:', errorText);
            throw new Error('Failed to load stations');
        }
        const stationsData = await stationsRes.json();
        console.log('Stations loaded:', stationsData);
        window.settingsStations = stationsData.stations || [];

        // Load devices - get ALL devices for dropdown (limit=0)
        const devicesRes = await fetch('/api/ewelink/devices?limit=0&_t=' + Date.now());
        if (!devicesRes.ok) {
            const errorText = await devicesRes.text();
            console.error('Devices API Error:', errorText);
            throw new Error('Failed to load devices');
        }
        const devicesData = await devicesRes.json();
        console.log('Devices API Response:', devicesData);
        console.log('Total devices from API:', devicesData.total, 'Data count:', devicesData.data?.length);
        window.settingsDevices = devicesData.data || [];

        renderSettings();

        // Update pagination
        if (window.settingsPagination) {
            console.log('[Settings] Pagination object:', window.settingsPagination, 'has update?', typeof window.settingsPagination.update);
            if (typeof window.settingsPagination.update === 'function') {
                window.settingsPagination.update(stationsData.page, stationsData.totalPages, stationsData.total);
            } else {
                console.error('[Settings] Pagination.update is not a function!');
            }
        } else {
            console.warn('[Settings] Pagination not initialized');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        document.getElementById('settingsTableBody').innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    Không thể tải dữ liệu
                </td>
            </tr>
        `;
    }
}

// Render settings table
function renderSettings() {
    const tbody = document.getElementById('settingsTableBody');
    const stations = window.settingsStations;
    const devices = window.settingsDevices;
    
    if (stations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <i class="fas fa-info-circle"></i> Không có trạm nào
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = stations.map(station => {
        const deviceOptions = devices.map(d => 
            `<option value="${d.deviceid}" ${station.ewelink_device_id === d.deviceid ? 'selected' : ''}>
                ${d.name} (${d.deviceid})
            </option>`
        ).join('');

        return `
            <tr>
                <td>${station.stationName}</td>
                <td><code>${station.id}</code></td>
                <td>
                    <select class="form-select form-select-sm" id="device_${station.id}">
                        <option value="">-- Chưa ánh xạ --</option>
                        ${deviceOptions}
                    </select>
                </td>
                <td>
                    ${station.ewelink_device_id 
                        ? '<span class="badge bg-success">Đã ánh xạ</span>' 
                        : '<span class="badge bg-secondary">Chưa ánh xạ</span>'}
                </td>
                <td>
                    <button class="btn btn-sm btn-primary me-1" onclick="saveMapping(${station.id})">
                        <i class="fas fa-save"></i> Lưu
                    </button>
                    ${station.ewelink_device_id 
                        ? `<button class="btn btn-sm btn-danger" onclick="deleteMapping(${station.id})">
                            <i class="fas fa-trash"></i> Xóa
                           </button>`
                        : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// Save mapping
async function saveMapping(stationId) {
    const deviceId = document.getElementById(`device_${stationId}`).value;
    
    if (!deviceId) {
        Swal.fire({
            icon: 'warning',
            title: 'Cảnh báo',
            text: 'Vui lòng chọn thiết bị'
        });
        return;
    }

    try {
        const response = await fetch('/api/stations/update-mapping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationId, deviceId })
        });

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Thành công',
                text: 'Đã cập nhật ánh xạ',
                timer: 2000
            });
            loadSettings(); // Reload
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: 'Không thể cập nhật'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: 'Không thể kết nối đến server'
        });
    }
}

// Delete mapping
async function deleteMapping(stationId) {
    // Convert to number to ensure type consistency
    const id = parseInt(stationId);
    const station = window.settingsStations.find(s => s.id == id);
    
    if (!station) {
        console.error('[Settings] Station not found:', stationId, 'Type:', typeof stationId);
        console.log('[Settings] Available stations:', window.settingsStations.map(s => s.id));
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: 'Không tìm thấy trạm'
        });
        return;
    }
    
    const result = await Swal.fire({
        icon: 'question',
        title: 'Xác nhận',
        text: `Bạn có chắc muốn xóa ánh xạ cho trạm "${station.stationName}"?`,
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#dc3545'
    });
    
    if (!result.isConfirmed) return;
    
    try {
        const response = await fetch(`/api/stations/mapping/${stationId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Thành công',
                text: 'Đã xóa ánh xạ',
                timer: 2000
            });
            loadSettings(); // Reload
        } else {
            const data = await response.json();
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: data.message || 'Không thể xóa ánh xạ'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: 'Không thể kết nối đến server'
        });
    }
}

// Init function for router
function loadSettingsData() {
    loadSettings();
}

// Fallback for direct access
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSettings);
} else {
    // DOM already loaded
    loadSettings();
}
