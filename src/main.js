const express = require('express');
const session = require('express-session');
const path = require('path');
const runMigrations = require('./migrations/index');
const { initCronJobs } = require('./utils/scheduler');
const logger = require('./utils/logger');

// Cấu hình Database
const db = require('./config/database');

// Services & Repos
const { fetchStations, fetchDynamicInfo } = require('./services/cgbasApi');
const { upsertStations, upsertDynamicInfo } = require('./repository/stationRepo');
const ewelinkService = require('./services/ewelinkService');
const ewelinkRepo = require('./repository/ewelinkRepo');

// Import Middleware
const { requireAuth } = require('./middleware/auth');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const stationRoutes = require('./routes/stationRoutes');
const ewelinkRoutes = require('./routes/ewelinkRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== CẤU HÌNH MIDDLEWARE ==========

// 1. Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Session Management (Phiên làm việc)
app.use(session({
    secret: process.env.SESSION_SECRET || 'cgbas-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 giờ
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' // HTTPS trong production
    },
    name: 'cgbas_session'
}));

// 3. Static files (CSS, JS, Images) - Public
app.use('/public', express.static(path.join(__dirname, 'public')));

// ========== ROUTES ==========

// PUBLIC ROUTES (Không cần đăng nhập)
app.use(authRoutes);

// PROTECTED ROUTES (Cần đăng nhập)
// Trang chủ
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

// API endpoints
app.use('/api/stations', requireAuth, stationRoutes);
app.use('/api/ewelink', requireAuth, ewelinkRoutes);

/**
 * Hàm hỗ trợ quét thiết bị eWelink vào DB lúc khởi động
 * Chỉ dùng 1 lần duy nhất khi bật server để ánh xạ ID.
 */
async function initialSyncEwelink() {
    try {
        logger.info('[eWelink] Quét thiết bị khởi tạo...');
        const res = await ewelinkService.getAllThings();
        if (res.error === 0 && res.data.thingList) {
            for (const thing of res.data.thingList) {
                if (thing.itemType === 1) await ewelinkRepo.upsertEwelinkDevice(thing.itemData);
            }
            logger.info(`[eWelink] Đã ánh xạ ${res.data.thingList.length} thiết bị.`);
        }
    } catch (err) { 
        logger.error('[eWelink Init Error]: ' + err.message);
    }
}

async function startServer() {
    try {
        // 1. Khởi tạo Database (Bao gồm bảng jobs mới)
        await runMigrations();

        // 2. Kích hoạt Scheduler (15s cho CGBAS & Recovery Monitor)
        initCronJobs();

        // 3. Đồng bộ khởi tạo
        logger.info('--- ĐỒNG BỘ KHỞI TẠO HỆ THỐNG ---');
        
        // CGBAS Initial
        const stResult = await fetchStations(1, 9999);
        if (stResult.code === 'SUCCESS') {
            await upsertStations(stResult.data.records);
            const ids = stResult.data.records.map(r => r.id);
            const dyResult = await fetchDynamicInfo(ids);
            if (dyResult.code === 'SUCCESS') await upsertDynamicInfo(dyResult.data);
            logger.info('✅ CGBAS: Đồng bộ thành công.');
        }

        // eWelink Initial (Chỉ lấy info thiết bị, không chạy cron sync 1p nữa)
        await initialSyncEwelink();
        logger.info('✅ eWelink: Quét khởi tạo hoàn tất.');

        // 4. Khởi động Web Server
        app.listen(PORT, () => {
            logger.info('-------------------------------------------------------');
            logger.info(`🚀 HỆ THỐNG PHỤC HỒI TRẠM ĐANG CHẠY: http://localhost:${PORT}`);
            logger.info('-------------------------------------------------------');
        });

    } catch (error) {
        logger.error('❌ LỖI KHỞI ĐỘNG: ' + error.message);
        process.exit(1);
    }
}

startServer();