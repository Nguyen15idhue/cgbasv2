const express = require('express');
const cron = require('node-cron');
const runMigrations = require('./migrations/index');
const { initCronJobs } = require('./utils/scheduler');

// Cấu hình Database
const db = require('./config/database');

// Services & Repos cho việc đồng bộ
const { fetchStations, fetchDynamicInfo } = require('./services/cgbasApi');
const { upsertStations, upsertDynamicInfo } = require('./repository/stationRepo');
const ewelinkService = require('./services/ewelinkService');
const ewelinkRepo = require('./repository/ewelinkRepo');

// Import Routes
const stationRoutes = require('./routes/stationRoutes');
const ewelinkRoutes = require('./routes/ewelinkRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Gắn các cụm Route (Endpoints)
app.use('/api/stations', stationRoutes); // VD: /api/stations/status
app.use('/api/ewelink', ewelinkRoutes);   // VD: /api/ewelink/devices, /api/ewelink/station-on...

/**
 * Hàm hỗ trợ đồng bộ eWelink (Dùng chung cho Khởi động và Cron)
 * Logic duyệt Family và Phân trang đã nằm trọn trong ewelinkService.getAllThings()
 */
async function syncAllEwelink() {
    try {
        console.log('[eWelink] Đang quét và đồng bộ toàn bộ thiết bị...');
        const res = await ewelinkService.getAllThings();
        
        if (res.error === 0 && res.data.thingList) {
            const things = res.data.thingList;
            console.log(`[eWelink] Tìm thấy tổng cộng ${things.length} thiết bị.`);
            
            for (const thing of things) {
                if (thing.itemType === 1) { // Chỉ lưu thiết bị vật lý
                    await ewelinkRepo.upsertEwelinkDevice(thing.itemData);
                }
            }
            console.log('[eWelink] Cập nhật Database thành công.');
        } else {
            console.error('[eWelink] Lỗi lấy dữ liệu:', res.msg);
        }
    } catch (err) {
        console.error('[eWelink Sync Error]:', err.message);
    }
}

/**
 * Hàm khởi động Server
 */
async function startServer() {
    try {
        // 1. Chạy migration tự động (Tạo DB, tạo Bảng trạm, tạo Bảng eWelink)
        await runMigrations();

        // 2. Kích hoạt các bộ lập lịch (Scheduler)
        initCronJobs(); // CGBAS: 15 giây/lần cho trạng thái vệ tinh

        // Lập lịch cho eWelink: Đồng bộ lại toàn bộ mỗi 1 phút
        // ĐÃ TẮT - Không tự động đồng bộ eWelink nữa
        // cron.schedule('*/1 * * * *', async () => {
        //     await syncAllEwelink();
        // });

        // 3. Thực hiện đồng bộ dữ liệu lần đầu (Initial Sync)
        console.log('\n--- BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU KHỞI TẠO ---');
        
        // --- Đồng bộ CGBAS ---
        try {
            const stResult = await fetchStations(1, 9999);
            if (stResult.code === 'SUCCESS') {
                await upsertStations(stResult.data.records);
                const ids = stResult.data.records.map(r => r.id);
                const dyResult = await fetchDynamicInfo(ids);
                if (dyResult.code === 'SUCCESS') {
                    await upsertDynamicInfo(dyResult.data);
                }
                console.log('✅ CGBAS: Đồng bộ thành công.');
            }
        } catch (cgErr) {
            console.error('❌ CGBAS: Khởi tạo thất bại:', cgErr.message);
        }

        // --- Đồng bộ eWelink ---
        await syncAllEwelink();
        console.log('✅ eWelink: Đồng bộ khởi tạo hoàn tất.');
        console.log('----------------------------------------\n');

        // 4. Khởi động Web Server
        app.listen(PORT, () => {
            console.log('-------------------------------------------------------');
            console.log(`🚀 SERVER ĐANG CHẠY TẠI: http://localhost:${PORT}`);
            console.log(`- API TRẠM (CGBAS): GET  /api/stations/status`);
            console.log(`- API THIẾT BỊ (EW): GET  /api/ewelink/devices`);
            console.log(`- API ĐIỀU KHIỂN LẺ: POST /api/ewelink/control`);
            console.log(`- API BẬT TRẠM (KB): POST /api/ewelink/station-on`);
            console.log(`- API TẮT TRẠM (KB): POST /api/ewelink/station-off`);
            console.log('-------------------------------------------------------');
        });

    } catch (error) {
        console.error('❌ LỖI KHỞI ĐỘNG HỆ THỐNG:', error.message);
        process.exit(1); // Thoát nếu không thể khởi động
    }
}

// Chạy ứng dụng
startServer();