/**
 * ⚡ eWeLink API Test Script
 * Kiểm tra kết nối và chức năng điều khiển thiết bị eWeLink
 */

const axios = require('axios');
require('dotenv').config();

// Màu sắc cho console log
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

// Helper functions
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(`  ${title}`, 'cyan');
    console.log('='.repeat(60) + '\n');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

// eWeLink API Configuration
const EWELINK_API = process.env.EWELINK_API || 'https://eu-apia.coolkit.cc';
const ACCESS_TOKEN = process.env.EWELINK_TOKEN;
const REFRESH_TOKEN = process.env.EWELINK_REFRESHTOKEN;
const APPID = process.env.EWELINK_APPID;

// Test 1: Kiểm tra cấu hình
function testConfiguration() {
    logSection('TEST 1: KIỂM TRA CẤU HÌNH');
    
    logInfo(`eWeLink API URL: ${EWELINK_API}`);
    logInfo(`Access Token: ${ACCESS_TOKEN ? ACCESS_TOKEN.substring(0, 20) + '...' : 'KHÔNG CÓ'}`);
    logInfo(`Refresh Token: ${REFRESH_TOKEN ? REFRESH_TOKEN.substring(0, 20) + '...' : 'KHÔNG CÓ'}`);
    logInfo(`App ID: ${APPID || 'KHÔNG CÓ'}`);
    
    if (!ACCESS_TOKEN) {
        logError('Thiếu EWELINK_TOKEN trong file .env');
        return false;
    }
    if (!REFRESH_TOKEN) {
        logWarning('Thiếu EWELINK_REFRESHTOKEN trong file .env');
    }
    if (!APPID) {
        logWarning('Thiếu EWELINK_APPID trong file .env');
    }
    
    logSuccess('Cấu hình OK!');
    return true;
}

// Test 2: Kiểm tra kết nối và lấy danh sách Family
async function testGetFamilies() {
    logSection('TEST 2: LẤY DANH SÁCH FAMILY (NHÀ)');
    
    try {
        logInfo('Đang gọi API /v2/family...');
        
        const response = await axios.get(`${EWELINK_API}/v2/family`, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        log('\n📥 Response Status: ' + response.status, 'gray');
        log('📥 Response Data:', 'gray');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.error === 0) {
            const families = response.data.data?.familyList || [];
            logSuccess(`Kết nối thành công! Tìm thấy ${families.length} family`);
            
            families.forEach((family, index) => {
                logInfo(`  ${index + 1}. ${family.name || 'Unnamed'} (ID: ${family.id})`);
            });
            
            return { success: true, families };
        } else {
            logError(`API trả về lỗi: ${response.data.msg || 'Unknown error'}`);
            logError(`Error Code: ${response.data.error}`);
            return { success: false, error: response.data };
        }
        
    } catch (error) {
        logError('Không thể kết nối API!');
        
        if (error.response) {
            logError(`HTTP Status: ${error.response.status}`);
            log('Response Data:', 'red');
            console.log(JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 401) {
                logWarning('Token đã hết hạn hoặc không hợp lệ!');
                logWarning('Hãy chạy Test 4 để refresh token hoặc lấy token mới từ app eWeLink');
            }
        } else if (error.request) {
            logError('Không nhận được response từ server');
            logError(`Message: ${error.message}`);
        } else {
            logError(`Error: ${error.message}`);
        }
        
        return { success: false, error };
    }
}

// Test 3: Lấy danh sách thiết bị
async function testGetDevices(familyId) {
    logSection('TEST 3: LẤY DANH SÁCH THIẾT BỊ');
    
    try {
        logInfo(`Đang lấy thiết bị của Family ID: ${familyId}...`);
        
        const response = await axios.get(`${EWELINK_API}/v2/device/thing`, {
            params: {
                familyid: familyId,
                begin: 0,
                num: 100
            },
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        log('\n📥 Response Status: ' + response.status, 'gray');
        log('📥 Response Data:', 'gray');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.error === 0) {
            const devices = response.data.data?.thingList || [];
            logSuccess(`Tìm thấy ${devices.length} thiết bị!`);
            
            devices.forEach((device, index) => {
                const online = device.itemData?.online ? '🟢 ONLINE' : '🔴 OFFLINE';
                const name = device.itemData?.name || 'Unnamed';
                const deviceId = device.itemData?.deviceid || 'N/A';
                const model = device.itemData?.extra?.model || 'N/A';
                
                logInfo(`  ${index + 1}. ${name} ${online}`);
                log(`     Device ID: ${deviceId}`, 'gray');
                log(`     Model: ${model}`, 'gray');
                
                // Hiển thị trạng thái switches nếu có
                const params = device.itemData?.params;
                if (params?.switches) {
                    log(`     Switches:`, 'gray');
                    params.switches.forEach((sw, idx) => {
                        const status = sw.switch === 'on' ? '🟢 ON' : '⚪ OFF';
                        log(`       Channel ${idx + 1}: ${status}`, 'gray');
                    });
                }
            });
            
            return { success: true, devices };
        } else {
            logError(`API trả về lỗi: ${response.data.msg || 'Unknown error'}`);
            return { success: false, error: response.data };
        }
        
    } catch (error) {
        logError('Không thể lấy danh sách thiết bị!');
        
        if (error.response) {
            logError(`HTTP Status: ${error.response.status}`);
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            logError(`Error: ${error.message}`);
        }
        
        return { success: false, error };
    }
}

// Test 4: Refresh Token
async function testRefreshToken() {
    logSection('TEST 4: REFRESH TOKEN');
    
    if (!REFRESH_TOKEN) {
        logError('Không có EWELINK_REFRESHTOKEN trong .env');
        return { success: false };
    }
    
    if (!APPID) {
        logError('Không có EWELINK_APPID trong .env');
        logInfo('App ID mặc định cho eWeLink: YzfeftUVcZ6twZw1OoVKPRFYTrGEg01Q');
        return { success: false };
    }
    
    try {
        logInfo('Đang refresh token...');
        
        const response = await axios.post(`${EWELINK_API}/v2/user/refresh`, {
            rt: REFRESH_TOKEN
        }, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-CK-Appid': APPID
            },
            timeout: 10000
        });
        
        log('\n📥 Response Status: ' + response.status, 'gray');
        log('📥 Response Data:', 'gray');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.error === 0 && response.data.data) {
            const { at, rt } = response.data.data;
            
            logSuccess('Refresh token thành công!');
            log('\n🔑 Token mới:', 'yellow');
            log(`EWELINK_TOKEN=${at}`, 'yellow');
            log(`EWELINK_REFRESHTOKEN=${rt}`, 'yellow');
            log('\n⚠️  Hãy cập nhật các giá trị trên vào file .env', 'yellow');
            
            return { success: true, tokens: { at, rt } };
        } else {
            logError(`Refresh token thất bại: ${response.data.msg || 'Unknown error'}`);
            return { success: false, error: response.data };
        }
        
    } catch (error) {
        logError('Không thể refresh token!');
        
        if (error.response) {
            logError(`HTTP Status: ${error.response.status}`);
            console.log(JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 403 || error.response.status === 401) {
                logWarning('Refresh token đã hết hạn hoặc không hợp lệ!');
                logWarning('Bạn cần lấy token mới từ app eWeLink:');
                logInfo('1. Tải ứng dụng eWeLink trên điện thoại');
                logInfo('2. Dùng công cụ như Charles Proxy hoặc mitmproxy để bắt token');
                logInfo('3. Hoặc liên hệ developer để được hướng dẫn');
            }
        } else {
            logError(`Error: ${error.message}`);
        }
        
        return { success: false, error };
    }
}

// Test 5: Điều khiển thiết bị
async function testControlDevice(deviceId, channel = 0, action = 'on') {
    logSection('TEST 5: ĐIỀU KHIỂN THIẾT BỊ');
    
    if (!deviceId) {
        logError('Không có Device ID để test');
        return { success: false };
    }
    
    try {
        logInfo(`Đang điều khiển thiết bị ${deviceId}...`);
        logInfo(`Channel: ${channel}, Action: ${action}`);
        
        const payload = {
            type: 1,
            id: deviceId,
            params: {
                switches: [{ switch: action, outlet: channel }]
            }
        };
        
        log('\n📤 Request Payload:', 'gray');
        console.log(JSON.stringify(payload, null, 2));
        
        const response = await axios.post(`${EWELINK_API}/v2/device/thing/status`, payload, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        log('\n📥 Response Status: ' + response.status, 'gray');
        log('📥 Response Data:', 'gray');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.error === 0) {
            logSuccess(`Điều khiển thành công! Channel ${channel + 1} → ${action.toUpperCase()}`);
            return { success: true, data: response.data };
        } else {
            logError(`Điều khiển thất bại: ${response.data.msg || 'Unknown error'}`);
            logError(`Error Code: ${response.data.error}`);
            
            // Giải thích các mã lỗi thường gặp
            const errorCodes = {
                504: 'Thiết bị offline (không kết nối internet)',
                400: 'Request không hợp lệ (sai định dạng)',
                401: 'Token hết hạn hoặc không hợp lệ',
                403: 'Không có quyền truy cập thiết bị này',
                10004: 'Thiết bị không tồn tại',
            };
            
            if (errorCodes[response.data.error]) {
                logWarning(`Giải thích: ${errorCodes[response.data.error]}`);
            }
            
            return { success: false, error: response.data };
        }
        
    } catch (error) {
        logError('Không thể điều khiển thiết bị!');
        
        if (error.response) {
            logError(`HTTP Status: ${error.response.status}`);
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            logError(`Error: ${error.message}`);
        }
        
        return { success: false, error };
    }
}

// Test 6: Kiểm tra API logs trong database
async function testDatabaseConnection() {
    logSection('TEST 6: KIỂM TRA KẾT NỐI DATABASE');
    
    try {
        const db = require('./src/config/database');
        
        logInfo('Đang kết nối database...');
        
        // Test connection
        await db.query('SELECT 1');
        logSuccess('Kết nối database thành công!');
        
        // Kiểm tra logs gần nhất
        const [logs] = await db.query(`
            SELECT * FROM ewelink_api_logs 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        if (logs.length > 0) {
            logInfo(`Tìm thấy ${logs.length} API logs gần nhất:`);
            logs.forEach((log, index) => {
                const time = new Date(log.created_at).toLocaleString('vi-VN');
                const status = log.response_code === 200 ? '✅' : '❌';
                console.log(`  ${index + 1}. ${status} ${log.method} ${log.endpoint} [${log.response_code}] - ${time}`);
            });
        } else {
            logWarning('Chưa có API logs nào trong database');
        }
        
        return { success: true };
    } catch (error) {
        logError('Không thể kết nối database!');
        logError(`Error: ${error.message}`);
        return { success: false, error };
    }
}

// Main Test Runner
async function runTests() {
    console.clear();
    log('\n⚡⚡⚡ eWeLink API TEST TOOL ⚡⚡⚡\n', 'cyan');
    log('Test Script bởi: CGBAS v2 System', 'gray');
    log(`Thời gian: ${new Date().toLocaleString('vi-VN')}\n`, 'gray');
    
    // Test 1: Configuration
    if (!testConfiguration()) {
        logError('\n❌ Test dừng vì thiếu cấu hình!');
        process.exit(1);
    }
    
    // Test 2: Get Families
    const familyResult = await testGetFamilies();
    
    if (!familyResult.success) {
        logWarning('\nTest 2 thất bại. Thử refresh token...');
        await testRefreshToken();
        logError('\n❌ Hãy cập nhật token mới vào .env và chạy lại test!');
        process.exit(1);
    }
    
    // Test 3: Get Devices
    if (familyResult.families && familyResult.families.length > 0) {
        const firstFamily = familyResult.families[0];
        const devicesResult = await testGetDevices(firstFamily.id);
        
        // Test 5: Control Device (nếu có thiết bị)
        if (devicesResult.success && devicesResult.devices && devicesResult.devices.length > 0) {
            const firstDevice = devicesResult.devices[0];
            const deviceId = firstDevice.itemData?.deviceid;
            
            if (deviceId) {
                logWarning('\n⚠️  Bỏ qua Test điều khiển thiết bị (để tránh bật/tắt nhầm)');
                logInfo('Nếu muốn test điều khiển, chạy lệnh:');
                log(`node test-ewelink.js control ${deviceId} 0 on`, 'yellow');
            }
        }
    }
    
    // Test 6: Database
    await testDatabaseConnection();
    
    // Summary
    logSection('📊 KẾT LUẬN');
    logSuccess('Hoàn thành tất cả các test!');
    log('\n💡 Nếu vẫn không điều khiển được thiết bị, kiểm tra:', 'cyan');
    logInfo('1. Thiết bị có đang online không?');
    logInfo('2. Token có còn hợp lệ không?');
    logInfo('3. Device ID có đúng không?');
    logInfo('4. Kiểm tra logs trong database hoặc file logs/');
    console.log('');
}

// Command line arguments
const args = process.argv.slice(2);

if (args[0] === 'control' && args[1]) {
    // Điều khiển trực tiếp: node test-ewelink.js control <deviceid> <channel> <action>
    const deviceId = args[1];
    const channel = parseInt(args[2]) || 0;
    const action = args[3] || 'on';
    
    testConfiguration();
    testControlDevice(deviceId, channel, action);
    
} else if (args[0] === 'refresh') {
    // Refresh token: node test-ewelink.js refresh
    testConfiguration();
    testRefreshToken();
    
} else {
    // Chạy tất cả tests
    runTests();
}
