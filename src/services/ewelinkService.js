const axios = require('axios');
const logger = require('../utils/logger');
const db = require('../config/database');
require('dotenv').config();

// Biến lưu token hiện tại (có thể thay đổi khi refresh)
let currentAccessToken = process.env.EWELINK_TOKEN;
let currentRefreshToken = process.env.EWELINK_REFRESHTOKEN;
let isRefreshing = false; // Flag để tránh refresh đồng thời
let refreshPromise = null; // Promise để các request chờ refresh xong

const ewelinkApi = axios.create({
    baseURL: process.env.EWELINK_API,
    headers: {
        'Content-Type': 'application/json'
    }
});

// INTERCEPTOR: Thêm token vào mỗi request
ewelinkApi.interceptors.request.use(request => {
    request.metadata = { startTime: new Date() };
    request.headers['Authorization'] = `Bearer ${currentAccessToken}`;
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
                    originalRequest.headers['Authorization'] = `Bearer ${currentAccessToken}`;
                    return ewelinkApi(originalRequest);
                }
                
                // Refresh token
                isRefreshing = true;
                refreshPromise = refreshAccessToken();
                
                await refreshPromise;
                
                // Retry request với token mới
                originalRequest.headers['Authorization'] = `Bearer ${currentAccessToken}`;
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
        logger.info('[eWelink] Token hết hạn, đang làm mới...');
        
        const response = await axios.post(`${process.env.EWELINK_API}/v2/user/refresh`, {
            rt: currentRefreshToken
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-CK-Appid': process.env.EWELINK_APPID
            }
        });
        
        if (response.data.error === 0 && response.data.data) {
            const { at, rt } = response.data.data;
            
            // Cập nhật token mới
            currentAccessToken = at;
            currentRefreshToken = rt;
            
            logger.info('[eWelink] ✅ Làm mới token thành công!');
            logger.warn('[eWelink] ⚠️  Vui lòng cập nhật .env với token mới:');
            logger.warn(`EWELINK_TOKEN=${at}`);
            logger.warn(`EWELINK_REFRESHTOKEN=${rt}`);
            
            // Lưu vào database để tracking (optional)
            try {
                await db.execute(
                    `INSERT INTO ewelink_api_logs (method, endpoint, payload, response_code, response_body, duration_ms) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    ['POST', '/v2/user/refresh', 'token_refresh', 200, 
                     JSON.stringify({ message: 'Token refreshed successfully' }), 0]
                );
            } catch (dbErr) {
                // Ignore DB error
            }
            
            return { at, rt };
        } else {
            throw new Error('Refresh token failed: ' + (response.data.msg || 'Unknown error'));
        }
        
    } catch (error) {
        logger.error('[eWelink] ❌ Lỗi refresh token: ' + error.message);
        logger.error('[eWelink] Token và Refresh Token hiện tại có thể đã hết hạn hoàn toàn.');
        logger.error('[eWelink] Vui lòng lấy token mới từ eWelink app và cập nhật vào .env');
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
 * Lấy token hiện tại (dùng để kiểm tra)
 */
function getCurrentTokens() {
    return {
        accessToken: currentAccessToken,
        refreshToken: currentRefreshToken
    };
}

/**
 * Cập nhật token thủ công (nếu cần)
 */
function updateTokens(newAccessToken, newRefreshToken) {
    if (newAccessToken) currentAccessToken = newAccessToken;
    if (newRefreshToken) currentRefreshToken = newRefreshToken;
    logger.info('[eWelink] Đã cập nhật token thủ công');
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
    forceRefreshToken
};