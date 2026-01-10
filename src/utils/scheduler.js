const cron = require('node-cron');
const logger = require('./logger');
const { fetchStations, fetchDynamicInfo } = require('../services/cgbasApi');
const { upsertStations, upsertDynamicInfo, getAllStationIds } = require('../repository/stationRepo');
const { checkAndTriggerRecovery } = require('./autoMonitor'); // Import bộ giám sát mới

let isSyncing = false;

function initCronJobs() {
    // Tác vụ 1: Chạy mỗi 15 giây (Vệ tinh + Giám sát phục hồi)
    cron.schedule('*/15 * * * * *', async () => {
        if (isSyncing) return;
        isSyncing = true;
        const now = new Date().toLocaleTimeString();
        
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

    logger.info('🚀 Scheduler: 15s (Satellite & Recovery Monitor) | 1h (Station List).');
}

module.exports = { initCronJobs };