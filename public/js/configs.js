// Configs Page Controller
console.log('[Configs] Loading configs page...');

// Load eWeLink configuration when page loads
loadEwelinkConfig();

// Event Listeners
document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
document.getElementById('updateEwelinkForm').addEventListener('submit', handleUpdateEwelink);
document.getElementById('btnTestToken').addEventListener('click', handleTestToken);

/**
 * Load current eWeLink configuration
 */
async function loadEwelinkConfig() {
    try {
        const response = await fetch('/api/configs/ewelink', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            const data = result.data;
            
            // Display config info (masked for security)
            document.getElementById('currentAppId').textContent = data.appId || 'Chưa thiết lập';
            document.getElementById('currentAppSecret').textContent = maskToken(data.appSecret);
            document.getElementById('currentApiUrl').textContent = data.apiUrl || 'https://as-apia.coolkit.cc';
            document.getElementById('currentAccessToken').textContent = maskToken(data.accessToken);
            document.getElementById('currentRefreshToken').textContent = maskToken(data.refreshToken);
            
            // Display expiry dates
            document.getElementById('tokenExpiry').textContent = formatDate(data.tokenExpiry);
            document.getElementById('refreshTokenExpiry').textContent = formatDate(data.refreshTokenExpiry);
            
            // Pre-fill form with current values
            document.getElementById('newAppId').value = data.appId || '';
            document.getElementById('newAppSecret').value = data.appSecret || '';
            document.getElementById('newApiUrl').value = data.apiUrl || 'https://as-apia.coolkit.cc';
            
            // Check if tokens are expiring soon
            checkTokenExpiry(data.tokenExpiry, data.refreshTokenExpiry);
        } else {
            showAlert('danger', result.message || 'Không thể tải thông tin cấu hình');
        }
    } catch (error) {
        console.error('[Configs] Error loading ewelink config:', error);
        showAlert('danger', 'Lỗi kết nối server');
    }
}

/**
 * Handle change password form submission
 */
async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate
    if (newPassword !== confirmPassword) {
        showAlert('danger', 'Mật khẩu mới và xác nhận không khớp!');
        return;
    }
    
    if (newPassword.length < 6) {
        showAlert('danger', 'Mật khẩu mới phải có ít nhất 6 ký tự!');
        return;
    }
    
    try {
        const response = await fetch('/api/configs/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Đổi mật khẩu thành công!');
            document.getElementById('changePasswordForm').reset();
        } else {
            showAlert('danger', result.message || 'Đổi mật khẩu thất bại!');
        }
    } catch (error) {
        console.error('[Configs] Error changing password:', error);
        showAlert('danger', 'Lỗi kết nối server');
    }
}

/**
 * Handle update ewelink config form submission
 */
async function handleUpdateEwelink(e) {
    e.preventDefault();
    
    const newAppId = document.getElementById('newAppId').value.trim();
    const newAppSecret = document.getElementById('newAppSecret').value.trim();
    const newApiUrl = document.getElementById('newApiUrl').value.trim();
    const newAccessToken = document.getElementById('newAccessToken').value.trim();
    const newRefreshToken = document.getElementById('newRefreshToken').value.trim();
    const tokenExpiryDate = document.getElementById('tokenExpiryDate').value;
    const refreshTokenExpiryDate = document.getElementById('refreshTokenExpiryDate').value;
    
    // Validate
    if (!newAppId || !newAppSecret || !newApiUrl) {
        showAlert('danger', 'Vui lòng nhập đầy đủ App ID, App Secret và API URL!');
        return;
    }
    
    // Confirm action
    if (!confirm('Bạn có chắc muốn cập nhật cấu hình eWeLink? Hành động này sẽ ảnh hưởng đến kết nối với thiết bị.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/configs/ewelink', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                appId: newAppId,
                appSecret: newAppSecret,
                apiUrl: newApiUrl,
                accessToken: newAccessToken || null,
                refreshToken: newRefreshToken || null,
                tokenExpiry: tokenExpiryDate || null,
                refreshTokenExpiry: refreshTokenExpiryDate || null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Cập nhật cấu hình thành công! Cấu hình mới đã được áp dụng.');
            document.getElementById('newAccessToken').value = '';
            document.getElementById('newRefreshToken').value = '';
            document.getElementById('tokenExpiryDate').value = '';
            document.getElementById('refreshTokenExpiryDate').value = '';
            
            // Reload config info
            setTimeout(() => loadEwelinkConfig(), 2000);
        } else {
            showAlert('danger', result.message || 'Cập nhật cấu hình thất bại!');
        }
    } catch (error) {
        console.error('[Configs] Error updating ewelink config:', error);
        showAlert('danger', 'Lỗi kết nối server');
    }
}

/**
 * Handle test token button click
 */
async function handleTestToken() {
    const newAccessToken = document.getElementById('newAccessToken').value.trim();
    
    if (!newAccessToken) {
        showAlert('warning', 'Vui lòng nhập Access Token để test!');
        return;
    }
    
    showAlert('info', 'Đang kiểm tra token...');
    
    try {
        const response = await fetch('/api/configs/test-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                accessToken: newAccessToken
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', `Token hợp lệ! ${result.message || ''}`);
        } else {
            showAlert('danger', result.message || 'Token không hợp lệ!');
        }
    } catch (error) {
        console.error('[Configs] Error testing token:', error);
        showAlert('danger', 'Lỗi kết nối server');
    }
}

/**
 * Mask token for security display
 */
function maskToken(token) {
    if (!token || token.length < 20) return '***';
    return token.substring(0, 10) + '...' + token.substring(token.length - 10);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return 'Chưa thiết lập';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Không hợp lệ';
    
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const formattedDate = date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    if (diffDays < 0) {
        return `<span style="color: #dc3545; font-weight: bold;">ĐÃ HẾT HẠN</span> - ${formattedDate}`;
    } else if (diffDays <= 7) {
        return `<span style="color: #ffc107; font-weight: bold;">Còn ${diffDays} ngày</span> - ${formattedDate}`;
    } else {
        return `<span style="color: #28a745;">Còn ${diffDays} ngày</span> - ${formattedDate}`;
    }
}

/**
 * Check if tokens are expiring soon and show warnings
 */
function checkTokenExpiry(tokenExpiry, refreshTokenExpiry) {
    const now = new Date();
    
    // Check access token
    if (tokenExpiry) {
        const tokenDate = new Date(tokenExpiry);
        const diffDays = Math.ceil((tokenDate - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            showAlert('danger', 'Access Token đã hết hạn! Vui lòng cập nhật token mới ngay.');
        } else if (diffDays <= 7) {
            showAlert('warning', `Access Token sắp hết hạn (còn ${diffDays} ngày)! Nên cập nhật sớm.`);
        }
    }
    
    // Check refresh token
    if (refreshTokenExpiry) {
        const refreshDate = new Date(refreshTokenExpiry);
        const diffDays = Math.ceil((refreshDate - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            showAlert('danger', 'Refresh Token đã hết hạn! Vui lòng cập nhật token mới ngay.');
        } else if (diffDays <= 14) {
            showAlert('warning', `Refresh Token sắp hết hạn (còn ${diffDays} ngày)! Nên cập nhật sớm.`);
        }
    }
}

/**
 * Show alert message
 */
function showAlert(type, message) {
    const alertContainer = document.getElementById('configAlert');
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `<i class="fas fa-${getAlertIcon(type)}"></i> ${message}`;
    
    alertContainer.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        alertDiv.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
}

/**
 * Get icon for alert type
 */
function getAlertIcon(type) {
    const icons = {
        'success': 'check-circle',
        'danger': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

console.log('[Configs] Configs page loaded successfully');
