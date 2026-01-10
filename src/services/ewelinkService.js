const axios = require('axios');
const logger = require('../utils/logger');
const db = require('../config/database');
require('dotenv').config();

const ewelinkApi = axios.create({
    baseURL: process.env.EWELINK_API,
    headers: {
        'Authorization': `Bearer ${process.env.EWELINK_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

// INTERCEPTOR: Bắt đầu Request
ewelinkApi.interceptors.request.use(request => {
    request.metadata = { startTime: new Date() }; // Lưu thời điểm bắt đầu
    return request;
});

// INTERCEPTOR: Xử lý Response (Thành công hoặc Thất bại)
ewelinkApi.interceptors.response.use(
    async (response) => {
        await logApiCall(response);
        return response;
    },
    async (error) => {
        await logApiCall(error.response || error);
        return Promise.reject(error);
    }
);

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

module.exports = { getAllThings, toggleChannel };