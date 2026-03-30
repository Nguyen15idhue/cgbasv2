// Configs Page Controller
console.log('[Configs] Loading configs page...');

// Load eWeLink configuration when page loads
loadEwelinkConfig();

// Load scheduled shutdown configuration
loadScheduledShutdownConfig();

// Event Listeners
document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
document.getElementById('updateEwelinkForm').addEventListener('submit', handleUpdateEwelink);
document.getElementById('btnTestToken').addEventListener('click', handleTestToken);

// OAuth Event Listeners
document.getElementById('btnEwelinkLogin').addEventListener('click', handleEwelinkLogin);
document.getElementById('btnRefreshToken').addEventListener('click', handleRefreshToken);

// Load OAuth status on startup
loadEwelinkLoginStatus();

// Scheduled Shutdown Event Listeners
document.getElementById('updateShutdownForm').addEventListener('submit', handleUpdateScheduledShutdown);
document.getElementById('btnTestShutdown').addEventListener('click', handleTestShutdown);
document.getElementById('btnRefreshStatus').addEventListener('click', loadScheduledShutdownConfig);

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

// ==================== OAUTH FUNCTIONS ====================

/**
 * Load eWeLink login status
 */
async function loadEwelinkLoginStatus() {
    try {
        const response = await fetch('/api/ewelink/login-status');
        const result = await response.json();
        
        const loginStatusDiv = document.getElementById('loginStatus');
        const btnLogin = document.getElementById('btnEwelinkLogin');
        const btnRefresh = document.getElementById('btnRefreshToken');
        
        if (result.success && result.data) {
            if (result.data.isLoggedIn) {
                const now = new Date();
                const tokenExpiry = result.data.tokenExpiry ? new Date(result.data.tokenExpiry) : null;
                const isTokenExpired = tokenExpiry && tokenExpiry < now;
                
                if (isTokenExpired) {
                    loginStatusDiv.innerHTML = '<span class="badge badge-warning"><i class="fas fa-exclamation-triangle"></i> Token đã hết hạn</span>';
                } else {
                    loginStatusDiv.innerHTML = '<span class="badge badge-success"><i class="fas fa-check"></i> Đã đăng nhập</span>';
                }
                
                if (result.data.tokenExpiry) {
                    loginStatusDiv.innerHTML += `<div style="margin-top: 5px; font-size: 12px;">Token hết hạn: ${formatDate(result.data.tokenExpiry)}</div>`;
                }
            } else {
                loginStatusDiv.innerHTML = '<span class="badge badge-secondary"><i class="fas fa-times"></i> Chưa đăng nhập</span>';
            }
            
            btnLogin.style.display = 'inline-block';
            btnRefresh.style.display = 'inline-block';
        }
    } catch (error) {
        console.error('[Configs] Error loading login status:', error);
    }
}

/**
 * Handle eWeLink OAuth Login
 */
async function handleEwelinkLogin() {
    try {
        const response = await fetch('/api/ewelink/auth-url');
        const result = await response.json();
        
        if (result.success && result.data && result.data.loginUrl) {
            // Open OAuth URL in new tab
            window.open(result.data.loginUrl, '_blank');
            showAlert('info', 'Vui lòng đăng nhập eWeLink trong tab mới. Sau khi đăng nhập thành công, bạn sẽ được chuyển về trang này.');
            
            // Check for OAuth result in URL params
            setTimeout(() => {
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('oauth') === 'success') {
                    showAlert('success', 'Đăng nhập eWeLink thành công!');
                    loadEwelinkLoginStatus();
                    loadEwelinkConfig();
                    // Clear URL params
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else if (urlParams.get('oauth') === 'error') {
                    showAlert('danger', 'Đăng nhập eWeLink thất bại!');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }, 3000);
        } else {
            showAlert('danger', result.message || 'Không thể lấy URL đăng nhập');
        }
    } catch (error) {
        console.error('[Configs] Error during OAuth login:', error);
        showAlert('danger', 'Lỗi kết nối server');
    }
}

/**
 * Handle refresh token manually
 */
async function handleRefreshToken() {
    if (!confirm('Bạn có chắc muốn refresh token ngay bây giờ?')) {
        return;
    }
    
    try {
        showAlert('info', 'Đang refresh token...');
        
        const response = await fetch('/api/ewelink/refresh-token', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Refresh token thành công!');
            loadEwelinkLoginStatus();
            loadEwelinkConfig();
        } else {
            showAlert('danger', result.message || 'Refresh token thất bại');
        }
    } catch (error) {
        console.error('[Configs] Error refreshing token:', error);
        showAlert('danger', 'Lỗi kết nối server');
    }
}

// ==================== SCHEDULED SHUTDOWN FUNCTIONS ====================

/**
 * Load scheduled shutdown configuration and status
 */
async function loadScheduledShutdownConfig() {
    try {
        // Load config and status
        const [configResponse, statusResponse] = await Promise.all([
            fetch('/api/scheduled-shutdown/config'),
            fetch('/api/scheduled-shutdown/status')
        ]);

        const configResult = await configResponse.json();
        const statusResult = await statusResponse.json();

        if (configResult.success && configResult.data) {
            const config = configResult.data;
            
            // Update status display
            document.getElementById('shutdownEnabled').textContent = config.is_enabled ? 'Đang bật' : 'Đã tắt';
            document.getElementById('shutdownEnabled').className = config.is_enabled ? 'badge badge-success' : 'badge badge-secondary';
            
            document.getElementById('shutdownTime').textContent = config.shutdown_time || 'N/A';
            document.getElementById('shutdownDuration').textContent = config.shutdown_duration_minutes + ' phút';
            document.getElementById('batchSize').textContent = config.batch_size + ' trạm';
            document.getElementById('batchDelay').textContent = config.batch_delay_seconds + ' giây';
            
            // Pre-fill form
            // Đảm bảo format đúng HH:MM:SS
            let timeValue = '02:00:00';
            if (config.shutdown_time) {
                // MySQL TIME trả về format "HH:MM:SS"
                timeValue = config.shutdown_time;
            }
            
            console.log('[Configs] Setting time input:', timeValue);
            document.getElementById('newShutdownTime').value = timeValue;
            document.getElementById('newShutdownDuration').value = config.shutdown_duration_minutes || 5;
            document.getElementById('newBatchSize').value = config.batch_size || 5;
            document.getElementById('newBatchDelay').value = config.batch_delay_seconds || 10;
            document.getElementById('newShutdownEnabled').checked = config.is_enabled || false;
        }

        if (statusResult.success && statusResult.data) {
            const status = statusResult.data;
            
            // Update running status
            document.getElementById('isRunning').textContent = status.is_running ? 'Đang chạy' : 'Không';
            document.getElementById('isRunning').className = status.is_running ? 'badge badge-warning' : 'badge badge-secondary';
            
            // Show/hide cancel button
            const btnCancel = document.getElementById('btnCancelShutdown');
            if (status.is_running) {
                btnCancel.style.display = 'inline-block';
            } else {
                btnCancel.style.display = 'none';
            }
            
            // Update label statistics
            const labelStats = document.getElementById('labelStats');
            if (status.label_statistics && status.label_statistics.length > 0) {
                labelStats.style.display = 'block';
                
                // Reset counts
                document.getElementById('statPending').textContent = '0';
                document.getElementById('statShuttingDown').textContent = '0';
                document.getElementById('statWaitingPoweron').textContent = '0';
                document.getElementById('statPoweringOn').textContent = '0';
                document.getElementById('statCompleted').textContent = '0';
                document.getElementById('statFailed').textContent = '0';
                
                // Update counts
                status.label_statistics.forEach(stat => {
                    if (stat.status === 'pending') {
                        document.getElementById('statPending').textContent = stat.count;
                    } else if (stat.status === 'shutting_down') {
                        document.getElementById('statShuttingDown').textContent = stat.count;
                    } else if (stat.status === 'waiting_poweron') {
                        document.getElementById('statWaitingPoweron').textContent = stat.count;
                    } else if (stat.status === 'powering_on') {
                        document.getElementById('statPoweringOn').textContent = stat.count;
                    } else if (stat.status === 'completed') {
                        document.getElementById('statCompleted').textContent = stat.count;
                    } else if (stat.status === 'failed') {
                        document.getElementById('statFailed').textContent = stat.count;
                    }
                });
            } else {
                labelStats.style.display = 'none';
            }
            
            // Update history table
            updateHistoryTable(status.recent_history || []);
        }
    } catch (error) {
        console.error('[Configs] Error loading scheduled shutdown config:', error);
        showAlert('danger', 'Lỗi tải cấu hình Scheduled Shutdown');
    }
}

/**
 * Update history table
 */
function updateHistoryTable(history) {
    const tbody = document.getElementById('historyTableBody');
    
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Chưa có lịch sử thực hiện</td></tr>';
        return;
    }
    
    tbody.innerHTML = history.map(h => {
        const statusBadge = h.status === 'completed' 
            ? '<span class="badge badge-success">Hoàn thành</span>' 
            : h.status === 'running' 
            ? '<span class="badge badge-warning">Đang chạy</span>' 
            : '<span class="badge badge-danger">Thất bại</span>';
        
        const startTime = h.started_at ? new Date(h.started_at).toLocaleString('vi-VN') : 'N/A';
        const endTime = h.completed_at ? new Date(h.completed_at).toLocaleString('vi-VN') : 'N/A';
        const executionDate = h.execution_date ? new Date(h.execution_date).toLocaleDateString('vi-VN') : 'N/A';
        
        return `
            <tr>
                <td>${executionDate}</td>
                <td><small>${startTime}</small></td>
                <td><small>${endTime}</small></td>
                <td>${h.total_stations || 0}</td>
                <td class="text-success"><strong>${h.successful_stations || 0}</strong></td>
                <td class="text-danger"><strong>${h.failed_stations || 0}</strong></td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Handle update scheduled shutdown config
 */
async function handleUpdateScheduledShutdown(e) {
    e.preventDefault();
    
    const shutdownTime = document.getElementById('newShutdownTime').value.trim();
    
    console.log('[Configs] Time input value:', shutdownTime);
    
    const shutdownDuration = parseInt(document.getElementById('newShutdownDuration').value);
    const batchSize = parseInt(document.getElementById('newBatchSize').value);
    const batchDelay = parseInt(document.getElementById('newBatchDelay').value);
    const isEnabled = document.getElementById('newShutdownEnabled').checked;
    
    // Validate
    if (!shutdownTime || !shutdownDuration || !batchSize || !batchDelay) {
        showAlert('danger', 'Vui lòng nhập đầy đủ thông tin!');
        return;
    }
    
    // Validate time format HH:MM:SS
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    if (!timeRegex.test(shutdownTime)) {
        showAlert('danger', 'Định dạng thời gian không hợp lệ! Vui lòng nhập theo định dạng HH:MM:SS (ví dụ: 02:00:00)');
        return;
    }
    
    if (shutdownDuration < 1 || shutdownDuration > 60) {
        showAlert('danger', 'Thời gian tắt phải từ 1-60 phút!');
        return;
    }
    
    if (batchSize < 1 || batchSize > 20) {
        showAlert('danger', 'Batch size phải từ 1-20!');
        return;
    }
    
    if (batchDelay < 5 || batchDelay > 60) {
        showAlert('danger', 'Batch delay phải từ 5-60 giây!');
        return;
    }
    
    // Confirm
    if (!confirm('Bạn có chắc muốn cập nhật cấu hình lịch tắt/bật trạm?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/scheduled-shutdown/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                shutdown_time: shutdownTime,
                shutdown_duration_minutes: shutdownDuration,
                batch_size: batchSize,
                batch_delay_seconds: batchDelay,
                is_enabled: isEnabled
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Cập nhật cấu hình thành công!');
            setTimeout(() => loadScheduledShutdownConfig(), 1000);
        } else {
            showAlert('danger', result.message || 'Cập nhật cấu hình thất bại!');
        }
    } catch (error) {
        console.error('[Configs] Error updating scheduled shutdown:', error);
        showAlert('danger', 'Lỗi kết nối server');
    }
}

/**
 * Handle test shutdown
 */
async function handleTestShutdown() {
    if (!confirm('Bạn có chắc muốn thực hiện test tắt/bật trạm NGAY BÂY GIỜ? Tất cả trạm sẽ bị tắt!')) {
        return;
    }
    
    try {
        showAlert('info', 'Đang bắt đầu quy trình tắt/bật trạm...');
        
        const response = await fetch('/api/scheduled-shutdown/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Đã bắt đầu quy trình! Theo dõi logs để xem tiến trình.');
            
            // Reload status after 2 seconds
            setTimeout(() => loadScheduledShutdownConfig(), 2000);
        } else {
            showAlert('danger', result.message || 'Không thể thực thi!');
        }
    } catch (error) {
        console.error('[Configs] Error executing test shutdown:', error);
        showAlert('danger', 'Lỗi kết nối server');
    }
}

/**
 * Handle cancel shutdown
 */
async function handleCancelShutdown() {
    if (!confirm('Bạn có chắc muốn HỦY quy trình đang chạy?')) {
        return;
    }
    
    try {
        showAlert('info', 'Đang gửi yêu cầu hủy...');
        
        const response = await fetch('/api/scheduled-shutdown/cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Đã gửi yêu cầu hủy! Quy trình sẽ dừng lại.');
            setTimeout(() => loadScheduledShutdownConfig(), 1000);
        } else {
            showAlert('warning', result.message || 'Không có quy trình nào đang chạy');
        }
    } catch (error) {
        console.error('[Configs] Error cancelling shutdown:', error);
        showAlert('danger', 'Lỗi kết nối server');
    }
}

/**
 * Show stations by status in modal
 */
async function showStationsByStatus(status) {
    try {
        const modal = document.getElementById('stationsModal');
        const modalBody = document.getElementById('stationsModalBody');
        const modalTitle = document.getElementById('modalStatusTitle');
        
        // Set title
        const statusTitles = {
            'pending': 'Pending',
            'shutting_down': 'Shutting Down',
            'waiting_poweron': 'Waiting Poweron',
            'powering_on': 'Powering On',
            'completed': 'Completed',
            'failed': 'Failed'
        };
        modalTitle.textContent = statusTitles[status] || status;
        
        // Show loading
        modalBody.innerHTML = '<tr><td colspan="5" class="text-center">Đang tải...</td></tr>';
        modal.classList.add('show');
        
        // Fetch stations
        const response = await fetch(`/api/scheduled-shutdown/stations?status=${status}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const stations = result.data;
            
            if (stations.length === 0) {
                modalBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Không có trạm nào</td></tr>';
                return;
            }
            
            modalBody.innerHTML = stations.map(s => {
                const labeledTime = s.labeled_at ? new Date(s.labeled_at).toLocaleString('vi-VN') : 'N/A';
                return `
                    <tr>
                        <td>${s.station_id}</td>
                        <td>${s.stationName || 'N/A'}</td>
                        <td>${s.identificationName || 'N/A'}</td>
                        <td><small>${labeledTime}</small></td>
                        <td><small class="text-danger">${s.error_message || '-'}</small></td>
                    </tr>
                `;
            }).join('');
        } else {
            modalBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Lỗi tải dữ liệu</td></tr>';
        }
    } catch (error) {
        console.error('[Configs] Error loading stations:', error);
        document.getElementById('stationsModalBody').innerHTML = '<tr><td colspan="5" class="text-center text-danger">Lỗi kết nối</td></tr>';
    }
}

/**
 * Close modal
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
}

/**
 * Load history with pagination
 */
let currentPage = 1;
const historyPerPage = 10;

async function loadHistoryPage(page) {
    try {
        const response = await fetch(`/api/scheduled-shutdown/history?page=${page}&limit=${historyPerPage}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            currentPage = page;
            const { data, pagination } = result.data;
            
            // Update table
            updateHistoryTable(data);
            
            // Update pagination controls
            const paginationDiv = document.getElementById('historyPagination');
            if (pagination.totalPages > 1) {
                paginationDiv.style.display = 'flex';
                document.getElementById('pageInfo').textContent = `Trang ${pagination.page} / ${pagination.totalPages}`;
                
                // Enable/disable buttons
                document.getElementById('btnPrevPage').disabled = pagination.page <= 1;
                document.getElementById('btnNextPage').disabled = pagination.page >= pagination.totalPages;
            } else {
                paginationDiv.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('[Configs] Error loading history page:', error);
    }
}

// Set up event listeners for Cancel button
document.getElementById('btnCancelShutdown').addEventListener('click', handleCancelShutdown);

// Set up event listeners for stat badges (click to show stations)
document.querySelectorAll('.stat-badge.clickable').forEach(badge => {
    badge.addEventListener('click', function() {
        const status = this.getAttribute('data-status');
        showStationsByStatus(status);
    });
});

// Set up event listeners for modal close
document.querySelectorAll('[data-dismiss="modal"]').forEach(btn => {
    btn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        modal.classList.remove('show');
    });
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
});

// Set up pagination event listeners
document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        loadHistoryPage(currentPage - 1);
    }
});

document.getElementById('btnNextPage').addEventListener('click', () => {
    loadHistoryPage(currentPage + 1);
});

// Load first page of history on startup
loadHistoryPage(1);

console.log('[Configs] Configs page loaded successfully');
