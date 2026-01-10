const axios = require('axios');
require('dotenv').config();

const ewelinkApi = axios.create({
    baseURL: process.env.EWELINK_API,
    headers: {
        'Authorization': `Bearer ${process.env.EWELINK_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

// Log request để debug
ewelinkApi.interceptors.request.use(request => {
    console.log(`[eWelink API] Request: ${request.method.toUpperCase()} ${request.url} ${JSON.stringify(request.params || {})}`);
    return request;
});

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
        console.error('[eWelink Service Error]:', error.message);
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