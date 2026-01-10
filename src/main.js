const express = require('express');
const runMigrations = require('./migrations/index');
const { initCronJobs } = require('./utils/scheduler');

// Cấu hình Database
const db = require('./config/database');

// Services & Repos
const { fetchStations, fetchDynamicInfo } = require('./services/cgbasApi');
const { upsertStations, upsertDynamicInfo } = require('./repository/stationRepo');
const ewelinkService = require('./services/ewelinkService');
const ewelinkRepo = require('./repository/ewelinkRepo');

// Import Routes
const stationRoutes = require('./routes/stationRoutes');
const ewelinkRoutes = require('./routes/ewelinkRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Endpoints
app.use('/api/stations', stationRoutes);
app.use('/api/ewelink', ewelinkRoutes);

/**
 * Hàm hỗ trợ quét thiết bị eWelink vào DB lúc khởi động
 * Chỉ dùng 1 lần duy nhất khi bật server để ánh xạ ID.
 */
async function initialSyncEwelink() {
    try {
        console.log('[eWelink] Quét thiết bị khởi tạo...');
        const res = await ewelinkService.getAllThings();
        if (res.error === 0 && res.data.thingList) {
            for (const thing of res.data.thingList) {
                if (thing.itemType === 1) await ewelinkRepo.upsertEwelinkDevice(thing.itemData);
            }
            console.log(`[eWelink] Đã ánh xạ ${res.data.thingList.length} thiết bị.`);
        }
    } catch (err) { console.error('[eWelink Init Error]:', err.message); }
}

async function startServer() {
    try {
        // 1. Khởi tạo Database (Bao gồm bảng jobs mới)
        await runMigrations();

        // 2. Kích hoạt Scheduler (15s cho CGBAS & Recovery Monitor)
        initCronJobs();

        // 3. Đồng bộ khởi tạo
        console.log('\n--- ĐỒNG BỘ KHỞI TẠO HỆ THỐNG ---');
        
        // CGBAS Initial
        const stResult = await fetchStations(1, 9999);
        if (stResult.code === 'SUCCESS') {
            await upsertStations(stResult.data.records);
            const ids = stResult.data.records.map(r => r.id);
            const dyResult = await fetchDynamicInfo(ids);
            if (dyResult.code === 'SUCCESS') await upsertDynamicInfo(dyResult.data);
            console.log('✅ CGBAS: Đồng bộ thành công.');
        }

        // eWelink Initial (Chỉ lấy info thiết bị, không chạy cron sync 1p nữa)
        await initialSyncEwelink();
        console.log('✅ eWelink: Quét khởi tạo hoàn tất.');

        // 4. Khởi động Web Server
        app.listen(PORT, () => {
            console.log('-------------------------------------------------------');
            console.log(`🚀 HỆ THỐNG PHỤC HỒI TRẠM ĐANG CHẠY: http://localhost:${PORT}`);
            console.log('-------------------------------------------------------');
        });

    } catch (error) {
        console.error('❌ LỖI KHỞI ĐỘNG:', error.message);
        process.exit(1);
    }
}

startServer();