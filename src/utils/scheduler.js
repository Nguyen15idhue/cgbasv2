const cron = require('node-cron');
const logger = require('./logger');
const { fetchStations, fetchDynamicInfo } = require('../services/cgbasApi');
const { upsertStations, upsertDynamicInfo, getAllStationIds } = require('../repository/stationRepo');
const { checkAndTriggerRecovery } = require('./autoMonitor'); // Import bộ giám sát mới
const scheduledShutdownService = require('../services/scheduledShutdownService'); // Import scheduled shutdown
const ewelinkOAuthService = require('../services/ewelinkOAuthService'); // Import OAuth service

let isSyncing = false;

// Filter out node-cron warnings về missed execution
// (warnings này không cần thiết vì ta đã handle bằng isSyncing flag)
const originalWarn = console.warn;
console.warn = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('[NODE-CRON]') && msg.includes('missed execution')) {
        return; // Bỏ qua warning này
    }
    originalWarn.apply(console, args);
};

function initCronJobs() {
    // Tác vụ 1: Chạy mỗi 5 giây (Vệ tinh + Giám sát phục hồi)
    // Tăng tần suất để phát hiện trạm online nhanh hơn và hỗ trợ cơ chế kiểm tra lồng
    cron.schedule('*/5 * * * * *', async () => {
        if (isSyncing) return;
        isSyncing = true;
        const now = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        
        try {
            const ids = await getAllStationIds();
            if (ids.length > 0) {
                logger.info(`[${now}] 📡 Đồng bộ vệ tinh & Kiểm tra phục hồi...`);
                
                // 1. Đồng bộ vệ tinh CGBAS
                const dyResult = await fetchDynamicInfo(ids);
                if (dyResult && dyResult.code === 'SUCCESS') {
                    await upsertDynamicInfo(dyResult.data);
                }

                // 2. Kích hoạt logic phục hồi trạm nếu có trạm offline (Tự động kiểm tra Job)
                await checkAndTriggerRecovery();
            }
        } catch (error) {
            logger.error(`[${now}] ❌ Lỗi Scheduler: ${error.message}`);
        } finally {
            isSyncing = false;
        }
    });

    // Tác vụ 2: Đồng bộ lại danh mục trạm mỗi giờ
    cron.schedule('0 * * * *', async () => {
        try {
            const stResult = await fetchStations(1, 9999);
            if (stResult.code === 'SUCCESS') await upsertStations(stResult.data.records);
        } catch (e) { 
            logger.error('Lỗi sync hàng giờ: ' + e.message);
        }
    });

    // Tác vụ 3: Kiểm tra lịch tắt/bật trạm hàng ngày (mỗi 30 giây)
    cron.schedule('*/30 * * * * *', async () => {
        try {
            const shouldRun = await scheduledShutdownService.shouldExecuteNow();
            if (shouldRun) {
                logger.info('[Scheduler] ⏰ Đến giờ thực hiện scheduled shutdown!');
                // Chạy bất đồng bộ để không block scheduler
                scheduledShutdownService.execute().catch(err => {
                    logger.error('[Scheduler] Lỗi scheduled shutdown: ' + err.message);
                });
            }
        } catch (e) {
            logger.error('[Scheduler] Lỗi kiểm tra scheduled shutdown: ' + e.message);
        }
    });

    // Tác vụ 4: Refresh eWeLink token mỗi 7 ngày (chạy vào 0h chủ nhật)
    cron.schedule('0 0 * * 0', async () => {
        try {
            logger.info('[Scheduler] 🔄 Bắt đầu refresh eWeLink token (7 ngày/lần)...');
            const result = await ewelinkOAuthService.autoRefreshToken();
            
            if (result.success) {
                logger.info('[Scheduler] ✅ Refresh eWeLink token thành công');
            } else {
                logger.warn('[Scheduler] ⚠️ Refresh eWeLink token thất bại: ' + result.reason);
            }
        } catch (e) {
            logger.error('[Scheduler] Lỗi refresh eWeLink token: ' + e.message);
        }
    });

    logger.info('🚀 Scheduler: 5s (Satellite & Recovery) | 1h (Station List) | 30s (Scheduled Shutdown) | 7 days (eWeLink Token).');
}

module.exports = { initCronJobs };