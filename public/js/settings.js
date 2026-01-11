// Settings Page JavaScript

// Use window scope to avoid redeclaration errors in SPA
window.settingsStations = window.settingsStations || [];
window.settingsDevices = window.settingsDevices || [];

// Load data
async function loadSettings() {
    try {
        // Load stations
        const stationsRes = await fetch('/api/stations/list');
        if (!stationsRes.ok) {
            const errorText = await stationsRes.text();
            console.error('Stations API Error:', errorText);
            throw new Error('Failed to load stations');
        }
        const stationsData = await stationsRes.json();
        console.log('Stations loaded:', stationsData);
        window.settingsStations = stationsData.stations || [];

        // Load devices
        const devicesRes = await fetch('/api/ewelink/devices');
        if (!devicesRes.ok) {
            const errorText = await devicesRes.text();
            console.error('Devices API Error:', errorText);
            throw new Error('Failed to load devices');
        }
        const devicesData = await devicesRes.json();
        console.log('Devices loaded:', devicesData);
        window.settingsDevices = devicesData.data || [];

        renderSettings();
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
                    <button class="btn btn-sm btn-primary" onclick="saveMapping(${station.id})">
                        <i class="fas fa-save"></i> Lưu
                    </button>
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
