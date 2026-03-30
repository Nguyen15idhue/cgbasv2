const axios = require('axios');
const CryptoJS = require('crypto-js');
const logger = require('../utils/logger');
const db = require('../config/database');
require('dotenv').config();

// Biến lưu config và token hiện tại (đọc từ DB ưu tiên)
let currentConfig = null;
let isRefreshing = false; // Flag để tránh refresh đồng thời
let refreshPromise = null; // Promise để các request chờ refresh xong
let configLoadPromise = null; // Promise để đảm bảo config chỉ load 1 lần

/**
 * Load cấu hình eWeLink từ database (ưu tiên) hoặc .env (fallback)
 */
async function loadConfigFromDB() {
    // Nếu đang load, return promise hiện tại
    if (configLoadPromise) {
        return configLoadPromise;
    }
    
    configLoadPromise = (async () => {
        try {
            const [rows] = await db.execute('SELECT * FROM ewelink_config LIMIT 1');
            
            if (rows.length > 0) {
                const config = rows[0];
                currentConfig = {
                    appId: config.app_id,
                    appSecret: config.app_secret,
                    apiUrl: config.api_url,
                    accessToken: config.access_token || '',
                    refreshToken: config.refresh_token || ''
                };
                
                logger.info('[eWelink] ✓ Đã load cấu hình từ database');
                logger.info(`[eWelink] API URL: ${currentConfig.apiUrl}`);
                
                // Cập nhật baseURL của axios instance
                ewelinkApi.defaults.baseURL = currentConfig.apiUrl;
                return currentConfig;
            } else {
                // Fallback to .env
                logger.warn('[eWelink] ⚠️  Chưa có cấu hình trong DB, sử dụng .env');
                currentConfig = {
                    appId: process.env.EWELINK_APPID || '',
                    appSecret: process.env.EWELINK_APPSECRET || '',
                    apiUrl: process.env.EWELINK_API || 'https://as-apia.coolkit.cc',
                    accessToken: process.env.EWELINK_TOKEN || '',
                    refreshToken: process.env.EWELINK_REFRESHTOKEN || ''
                };
                return currentConfig;
            }
        } catch (error) {
            logger.error('[eWelink] Lỗi load config từ DB: ' + error.message);
            logger.warn('[eWelink] Fallback to .env config');
            
            // Fallback to .env on error
            currentConfig = {
                appId: process.env.EWELINK_APPID || '',
                appSecret: process.env.EWELINK_APPSECRET || '',
                apiUrl: process.env.EWELINK_API || 'https://as-apia.coolkit.cc',
                accessToken: process.env.EWELINK_TOKEN || '',
                refreshToken: process.env.EWELINK_REFRESHTOKEN || ''
            };
            return currentConfig;
        }
    })();
    
    return configLoadPromise;
}

const ewelinkApi = axios.create({
    baseURL: 'https://as-apia.coolkit.cc', // Default, sẽ được update sau khi load config
    headers: {
        'Content-Type': 'application/json'
    }
});

// INTERCEPTOR: Thêm token vào mỗi request
ewelinkApi.interceptors.request.use(async (request) => {
    // Đảm bảo config đã được load từ DB
    if (!currentConfig) {
        await loadConfigFromDB();
    }
    
    request.metadata = { startTime: new Date() };
    request.headers['Authorization'] = `Bearer ${currentConfig.accessToken}`;
    request.headers['X-CK-Appid'] = currentConfig.appId;
    return request;
});

// INTERCEPTOR: Xử lý Response (Thành công hoặc Thất bại)
ewelinkApi.interceptors.response.use(
    async (response) => {
        await logApiCall(response);
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        
        // Kiểm tra nếu lỗi 401 (token hết hạn) và chưa retry
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                // Nếu đang refresh, đợi refresh xong
                if (isRefreshing) {
                    await refreshPromise;
                    // Retry request với token mới
                    originalRequest.headers['Authorization'] = `Bearer ${currentConfig.accessToken}`;
                    return ewelinkApi(originalRequest);
                }
                
                // Refresh token
                isRefreshing = true;
                refreshPromise = refreshAccessToken();
                
                await refreshPromise;
                
                // Retry request với token mới
                originalRequest.headers['Authorization'] = `Bearer ${currentConfig.accessToken}`;
                return ewelinkApi(originalRequest);
                
            } catch (refreshError) {
                logger.error('[eWelink] Không thể refresh token: ' + refreshError.message);
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
                refreshPromise = null;
            }
        }
        
        await logApiCall(error.response || error);
        return Promise.reject(error);
    }
);

/**
 * Refresh Access Token khi hết hạn
 */
async function refreshAccessToken() {
    try {
        // Đảm bảo config đã được load
        if (!currentConfig) {
            await loadConfigFromDB();
        }
        
        if (!currentConfig.refreshToken) {
            throw new Error('Không có refresh token');
        }
        
        logger.info('[eWelink] Token hết hạn, đang làm mới...');
        
        const apiUrl = currentConfig.apiUrl || process.env.EWELINK_API || 'https://as-apia.coolkit.cc';
        const appId = currentConfig.appId || process.env.EWELINK_APPID;
        
        logger.info('[eWelink] Refresh - accessToken: ' + (currentConfig.accessToken ? 'exists' : 'empty'));
        logger.info('[eWelink] Refresh - refreshToken: ' + (currentConfig.refreshToken ? 'exists' : 'empty'));
        
        const response = await axios.post(`${apiUrl}/v2/user/refresh`, {
            rt: currentConfig.refreshToken
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-CK-Appid': appId
            }
        });
        
        if (response.data.error === 0 && response.data.data) {
            const { at, rt } = response.data.data;
            
            // Cập nhật token mới vào memory
            currentConfig.accessToken = at;
            currentConfig.refreshToken = rt;
            
            logger.info('[eWelink] ✅ Làm mới token thành công!');
            
            // Lưu vào database
            try {
                const [rows] = await db.execute('SELECT id FROM ewelink_config LIMIT 1');
                if (rows.length > 0) {
                    const atExpiredTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
                    const rtExpiredTime = Date.now() + (365 * 24 * 60 * 60 * 1000);
                    
                    await db.execute(
                        `UPDATE ewelink_config 
                        SET access_token = ?, refresh_token = ?, token_expiry = FROM_UNIXTIME(?/1000), refresh_token_expiry = FROM_UNIXTIME(?/1000), updated_at = NOW()
                        WHERE id = ?`,
                        [at, rt, atExpiredTime, rtExpiredTime, rows[0].id]
                    );
                    logger.info('[eWelink] ✅ Token đã lưu vào database');
                }
            } catch (dbErr) {
                logger.error('[eWelink] Lỗi lưu token vào DB: ' + dbErr.message);
            }
            
            return { at, rt };
        } else {
            throw new Error('Refresh token failed: ' + (response.data.msg || 'Unknown error'));
        }
        
    } catch (error) {
        logger.error('[eWelink] ❌ Lỗi refresh token: ' + error.message);
        logger.error('[eWelink] Token và Refresh Token hiện tại có thể đã hết hạn hoàn toàn.');
        throw error;
    }
}

/**
 * Hàm ghi log vào Database
 */
async function logApiCall(res) {
    try {
        const endTime = new Date();
        const config = res.config || res.response?.config;
        if (!config) return;

        const duration = endTime - config.metadata.startTime;
        const method = config.method.toUpperCase();
        const endpoint = config.url;
        const payload = config.data || '';
        const responseCode = res.status || 0;
        const responseBody = JSON.stringify(res.data || {});

        // Lưu vào MySQL
        await db.execute(
            `INSERT INTO ewelink_api_logs (method, endpoint, payload, response_code, response_body, duration_ms) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [method, endpoint, payload, responseCode, responseBody, duration]
        );
    } catch (err) {
        logger.error('[Logger] Lỗi ghi log API: ' + err.message);
    }
}


/**
 * Hàm lấy danh sách tất cả Family (Nhà)
 */
async function getAllFamilies() {
    const response = await ewelinkApi.get('/v2/family');
    return response.data;
}

/**
 * Hàm lấy thiết bị theo trang của một Family cụ thể
 */
async function getThingsPage(familyid, begin = 0, num = 100) {
    const response = await ewelinkApi.get('/v2/device/thing', {
        params: { familyid, begin, num }
    });
    return response.data;
}

/**
 * LẤY TOÀN BỘ THIẾT BỊ (Đã sửa lỗi phân trang và thiếu Family)
 * Hàm này tự động quét qua tất cả Family và tất cả các trang.
 * Trả về định dạng giống API eWelink để main.js không phải sửa nhiều.
 */
async function getAllThings() {
    try {
        const allThings = [];
        const familyRes = await getAllFamilies();

        if (familyRes.error !== 0 || !familyRes.data.familyList) {
            return { error: familyRes.error, msg: familyRes.msg, data: { thingList: [] } };
        }

        const families = familyRes.data.familyList;

        for (const family of families) {
            let begin = 0;
            const num = 100;
            let hasMore = true;

            while (hasMore) {
                const pageRes = await getThingsPage(family.id, begin, num);
                
                if (pageRes.error === 0 && pageRes.data.thingList) {
                    const list = pageRes.data.thingList;
                    allThings.push(...list);

                    // Nếu lấy được ít hơn số lượng yêu cầu (num), nghĩa là đã hết trang
                    if (list.length < num) {
                        hasMore = false;
                    } else {
                        begin += num;
                    }
                } else {
                    hasMore = false; // Lỗi ở trang này thì dừng quét family này
                }
            }
        }

        // Trả về kết quả tổng hợp
        return {
            error: 0,
            data: { thingList: allThings }
        };

    } catch (error) {
        logger.error('[eWelink Service Error]: ' + error.message);
        return { error: 500, msg: error.message, data: { thingList: [] } };
    }
}

/**
 * Điều khiển bật/tắt kênh
 * outlet: 0 hoặc 1
 * status: 'on' hoặc 'off'
 */
async function toggleChannel(deviceid, outlet, status) {
    const payload = {
        type: 1,
        id: deviceid,
        params: {
            switches: [{ switch: status, outlet: outlet }]
        }
    };
    const response = await ewelinkApi.post('/v2/device/thing/status', payload);
    return response.data;
}

/**
 * Lấy token và config hiện tại (dùng để kiểm tra)
 */
function getCurrentTokens() {
    if (!currentConfig) {
        logger.warn('[eWelink] Config chưa được load, trả về rỗng');
        return {
            accessToken: '',
            refreshToken: ''
        };
    }
    return {
        accessToken: currentConfig.accessToken,
        refreshToken: currentConfig.refreshToken
    };
}

/**
 * Cập nhật token thủ công (nếu cần)
 */
async function updateTokens(newAccessToken, newRefreshToken) {
    if (!currentConfig) {
        await loadConfigFromDB();
    }
    if (newAccessToken) currentConfig.accessToken = newAccessToken;
    if (newRefreshToken) currentConfig.refreshToken = newRefreshToken;
    logger.info('[eWelink] Đã cập nhật token thủ công');
}

/**
 * Cập nhật toàn bộ config thủ công (gọi từ API)
 */
async function updateConfig(config) {
    // Đảm bảo currentConfig đã được khởi tạo
    if (!currentConfig) {
        await loadConfigFromDB();
    }
    
    if (config.appId) currentConfig.appId = config.appId;
    if (config.appSecret) currentConfig.appSecret = config.appSecret;
    if (config.apiUrl) {
        currentConfig.apiUrl = config.apiUrl;
        ewelinkApi.defaults.baseURL = config.apiUrl;
    }
    if (config.accessToken) currentConfig.accessToken = config.accessToken;
    if (config.refreshToken) currentConfig.refreshToken = config.refreshToken;
    logger.info('[eWelink] Đã cập nhật cấu hình thủ công');
}

/**
 * Force refresh token ngay lập tức
 */
async function forceRefreshToken() {
    return await refreshAccessToken();
}

module.exports = { 
    getAllThings, 
    toggleChannel,
    getCurrentTokens,
    updateTokens,
    updateConfig,
    forceRefreshToken,
    loadConfigFromDB
};

// Khởi tạo: Load config từ DB ngay khi module được require
loadConfigFromDB().catch(err => {
    logger.error('[eWelink] Lỗi load config khi khởi động:', err.message);
});