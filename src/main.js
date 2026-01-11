const express = require('express');
const session = require('express-session');
const cors = require('cors');
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

// 1. CORS (Cho phép AJAX requests)
app.use(cors({
    origin: true,
    credentials: true
}));

// 2. Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Static files (CSS, JS, Images) - PHẢI Ở ĐẦU để browser load được JS files
app.use(express.static(path.join(__dirname, '../public')));

// 4. Session Management (Phiên làm việc)
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

// ========== ROUTES ==========

// Log all requests for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// PUBLIC ROUTES (Không cần đăng nhập)
app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, '../public/views/login.html'));
});

app.use('/api/auth', authRoutes);

// Serve partials for SPA
app.get('/partials/:page', requireAuth, (req, res) => {
    const pageName = req.params.page;
    const allowedPages = ['dashboard', 'queue', 'stations', 'devices', 'logs', 'settings'];
    
    if (allowedPages.includes(pageName)) {
        res.sendFile(path.join(__dirname, `../public/partials/${pageName}.html`));
    } else {
        res.status(404).send('Page not found');
    }
});

// PROTECTED PAGE ROUTES (Cần đăng nhập) - Serve SPA index.html
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/queue', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/stations', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/devices', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/logs', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/settings', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API Dashboard stats
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
        // Get station stats
        const [stations] = await db.execute('SELECT connectStatus FROM station_dynamic_info');
        const onlineStations = stations.filter(s => s.connectStatus === 1).length;
        const offlineStations = stations.filter(s => s.connectStatus === 0).length;
        
        // Get pending jobs
        const [jobs] = await db.execute('SELECT COUNT(*) as count FROM station_recovery_jobs WHERE status != "SUCCESS"');
        const pendingJobs = jobs[0].count;
        
        // Get recovered today
        const [recovered] = await db.execute(`
            SELECT COUNT(*) as count FROM station_recovery_jobs 
            WHERE status = "SUCCESS" AND DATE(updated_at) = CURDATE()
        `);
        const recoveredToday = recovered[0].count;
        
        res.json({
            onlineStations,
            offlineStations,
            pendingJobs,
            recoveredToday,
            user: req.session.user
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API Queue jobs
app.get('/api/queue/jobs', requireAuth, async (req, res) => {
    try {
        const [jobs] = await db.execute(`
            SELECT 
                srj.*,
                s.stationName,
                ed.name as device_name
            FROM station_recovery_jobs srj
            LEFT JOIN stations s ON srj.station_id = s.id
            LEFT JOIN ewelink_devices ed ON srj.device_id = ed.deviceid
            ORDER BY srj.created_at DESC
        `);
        res.json({ jobs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API Delete job
app.delete('/api/queue/jobs/:stationId', requireAuth, async (req, res) => {
    try {
        await db.execute('DELETE FROM station_recovery_jobs WHERE station_id = ?', [req.params.stationId]);
        res.json({ success: true, message: 'Job deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PROTECTED API ROUTES (Cần đăng nhập)
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
        app.listen(PORT, '0.0.0.0', () => {
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