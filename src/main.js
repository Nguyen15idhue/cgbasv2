const express = require('express');
const db = require('./config/database'); // <--- THÊM DÒNG NÀY
const runMigrations = require('./migrations/index');
const { initCronJobs } = require('./utils/scheduler');
const { fetchStations, fetchDynamicInfo } = require('./services/cgbasApi');
const { upsertStations, upsertDynamicInfo, getAllStationIds } = require('./repository/stationRepo');

const app = express();
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // 1. Chạy migration tạo DB/Table
        await runMigrations();

        // 2. Kích hoạt Cron Job (Chạy ngầm mỗi 15 phút)
        initCronJobs();

        // 3. Đồng bộ dữ liệu ban đầu khi khởi động
        console.log('--- Đang đồng bộ dữ liệu khởi tạo ---');
        const stResult = await fetchStations(1, 9999);
        if (stResult.code === 'SUCCESS') {
            await upsertStations(stResult.data.records);
            
            // Sau khi có stations, lấy luôn dynamic info
            const ids = stResult.data.records.map(r => r.id);
            const dyResult = await fetchDynamicInfo(ids);
            if (dyResult.code === 'SUCCESS') {
                await upsertDynamicInfo(dyResult.data);
            }
            console.log('Đồng bộ khởi tạo hoàn tất.');
        }

        // 4. API lấy thông tin trạm kèm trạng thái vệ tinh
        app.get('/api/stations-status', async (req, res) => {
            try {
                // Biến 'db' bây giờ đã được định nghĩa nhờ dòng require ở trên
                const [rows] = await db.query(`
                    SELECT s.*, d.connectStatus, d.delay, d.sat_R, d.sat_C, d.sat_E, d.sat_G, d.updateTime as lastDynamicUpdate
                    FROM stations s
                    LEFT JOIN station_dynamic_info d ON s.id = d.stationId
                    ORDER BY s.stationName ASC
                `);
                res.json({ success: true, total: rows.length, data: rows });
            } catch (err) {
                console.error(err);
                res.status(500).json({ success: false, message: err.message });
            }
        });

        // 5. Khởi động server
        app.listen(PORT, () => {
            console.log(`🚀 Server: http://localhost:${PORT}/api/stations-status`);
        });

    } catch (error) {
        console.error('Lỗi khởi động hệ thống:', error.message);
    }
}

startServer();