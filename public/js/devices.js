// Devices Page JavaScript

// Load devices data
async function loadDevicesData() {
    try {
        const response = await fetch('/api/ewelink/devices');
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load devices');
        }

        const result = await response.json();
        const devices = result.data || [];
        
        renderDevices(devices);
    } catch (error) {
        console.error('Error loading devices:', error);
        document.getElementById('devicesTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    Không thể tải danh sách thiết bị
                </td>
            </tr>
        `;
    }
}

// Render devices table
function renderDevices(devices) {
    const tbody = document.getElementById('devicesTableBody');
    
    if (devices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <i class="fas fa-info-circle"></i> Không có thiết bị nào
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = devices.map(device => `
        <tr>
            <td>${device.name || 'N/A'}</td>
            <td><code>${device.deviceid}</code></td>
            <td>
                <span class="badge ${device.switch_0 === 'on' ? 'bg-success' : 'bg-secondary'}">
                    ${device.switch_0 === 'on' ? 'BẬT' : 'TẮT'}
                </span>
            </td>
            <td>
                <span class="badge ${device.switch_1 === 'on' ? 'bg-success' : 'bg-secondary'}">
                    ${device.switch_1 === 'on' ? 'BẬT' : 'TẮT'}
                </span>
            </td>
            <td>${device.voltage_0 || 'N/A'}V</td>
            <td>${device.lastStatusUpdate ? new Date(device.lastStatusUpdate).toLocaleString('vi-VN') : 'N/A'}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-success" onclick="controlDevice('${device.deviceid}', 1, 'on')">
                        <i class="fas fa-power-off"></i> Kênh 1
                    </button>
                    <button class="btn btn-outline-danger" onclick="controlDevice('${device.deviceid}', 1, 'off')">
                        <i class="fas fa-ban"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Control device
async function controlDevice(deviceid, channel, action) {
    try {
        const response = await fetch('/api/ewelink/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceid, channel, action })
        });

        const data = await response.json();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Thành công',
                text: data.message,
                timer: 2000
            });
            loadDevices(); // Reload
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: data.message
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
