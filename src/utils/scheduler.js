const cron = require('node-cron');
const { fetchStations, fetchDynamicInfo } = require('../services/cgbasApi');
const { upsertStations, upsertDynamicInfo, getAllStationIds } = require('../repository/stationRepo');

// Biến khóa để tránh chạy chồng chéo dữ liệu
let isSyncing = false;

function initCronJobs() {
    // Tác vụ 1: Cập nhật thông tin động mỗi 15 giây
    // Cấu hình: '*/15 * * * * *' (Giây - Phút - Giờ - Ngày - Tháng - Thứ)
    cron.schedule('*/15 * * * * *', async () => {
        if (isSyncing) {
            console.log('⚠️ Chu kỳ trước vẫn đang chạy, bỏ qua chu kỳ này.');
            return;
        }

        isSyncing = true; // Khóa
        const now = new Date().toLocaleTimeString();
        
        try {
            // 1. Lấy danh sách ID trạm từ DB
            const ids = await getAllStationIds();
            
            if (ids.length > 0) {
                console.log(`[${now}] 📡 Đang cập nhật trạng thái vệ tinh (15s/lần)...`);
                
                // 2. Gọi API thông tin động
                const dyResult = await fetchDynamicInfo(ids);
                
                if (dyResult && dyResult.code === 'SUCCESS') {
                    await upsertDynamicInfo(dyResult.data);
                    console.log(`[${now}] ✅ Cập nhật thành công.`);
                }
            } else {
                // Nếu DB trống, thử lấy danh sách trạm trước
                const stResult = await fetchStations(1, 9999);
                if (stResult.code === 'SUCCESS') {
                    await upsertStations(stResult.data.records);
                }
            }
        } catch (error) {
            console.error(`[${now}] ❌ Lỗi đồng bộ nhanh:`, error.message);
        } finally {
            isSyncing = false; // Mở khóa
        }
    });

    // Tác vụ 2: Đồng bộ lại danh sách trạm mỗi 1 giờ (để cập nhật tên, tọa độ nếu có thay đổi)
    cron.schedule('0 * * * *', async () => {
        console.log('🔄 Đang đồng bộ lại danh sách trạm (Định kỳ hàng giờ)...');
        try {
            const stResult = await fetchStations(1, 9999);
            if (stResult.code === 'SUCCESS') {
                await upsertStations(stResult.data.records);
            }
        } catch (e) {
            console.error('Lỗi đồng bộ danh sách trạm hàng giờ:', e.message);
        }
    });

    console.log('🚀 Scheduler: Đã kích hoạt (15 giây/lần cho vệ tinh, 1 giờ/lần cho danh sách trạm).');
}

module.exports = { initCronJobs };