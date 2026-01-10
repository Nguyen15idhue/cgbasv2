const ewelinkService = require('./ewelinkService');
const cgbasApi = require('./cgbasApi');
const { sleep, retryAction } = require('../utils/helper');
const logger = require('../utils/logger');
const db = require('../config/database');

const RETRY_INTERVALS = [2, 5, 7, 10, 15, 30]; // Phút chờ

/**
 * Hàm hỗ trợ lập lịch thử lại khi có bất kỳ lỗi nào xảy ra (Offline hoặc API Fail)
 */
async function rescheduleJob(station_id, retry_index, reason) {
    const waitMin = RETRY_INTERVALS[retry_index] || 60;
    const nextRun = new Date(Date.now() + waitMin * 60000);
    
    logger.warn(`[Job ${station_id}] ⚠️ Tạm dừng do: ${reason}. Thử lại sau ${waitMin} phút.`);
    
    await db.execute(
        'UPDATE station_recovery_jobs SET status = "PENDING", retry_index = ?, next_run_time = ? WHERE station_id = ?',
        [retry_index + 1, nextRun, station_id]
    );
}

async function runAutoRecovery(job) {
    const { station_id, device_id, retry_index } = job;
    
    try {
        // 1. Đánh dấu đang chạy
        await db.execute('UPDATE station_recovery_jobs SET status = "RUNNING" WHERE station_id = ?', [station_id]);

        // 2. Kiểm tra Online
        const deviceRes = await ewelinkService.getAllThings();
        const device = deviceRes.data.thingList.find(t => t.itemData.deviceid === device_id);

        if (!device || !device.itemData.online) {
            return await rescheduleJob(station_id, retry_index, "Thiết bị eWelink Ngoại tuyến");
        }

        // 3. Kiểm tra Kênh 1 và thực hiện kịch bản
        const switches = device.itemData.params.switches || [];
        const ch1Status = switches.find(s => s.outlet === 0)?.switch;

        // --- THỰC THI LỆNH VỚI CƠ CHẾ RESCHEDULE NẾU FAIL ---
        
        if (ch1Status === 'off') {
            logger.info(`[Job ${station_id}] FULL KỊCH BẢN...`);
            const ok1 = await retryAction(() => ewelinkService.toggleChannel(device_id, 0, 'on'), "Bật Kênh 1");
            if (!ok1) return await rescheduleJob(station_id, retry_index, "Lỗi API khi Bật Kênh 1");
            
            await sleep(10000);
        }

        // Kích nút (Kênh 2)
        const ok2 = await retryAction(() => ewelinkService.toggleChannel(device_id, 1, 'on'), "Bật Kênh 2");
        if (!ok2) return await rescheduleJob(station_id, retry_index, "Lỗi API khi Bật Kênh 2");
        
        await sleep(5000);
        
        const ok3 = await retryAction(() => ewelinkService.toggleChannel(device_id, 1, 'off'), "Tắt Kênh 2");
        if (!ok3) return await rescheduleJob(station_id, retry_index, "Lỗi API khi Tắt Kênh 2");

        // 4. Chờ kiểm tra kết quả cuối cùng trên CGBAS
        logger.info(`[Job ${station_id}] Điều khiển xong. Chờ 2 phút check CGBAS...`);
        await db.execute('UPDATE station_recovery_jobs SET status = "CHECKING" WHERE station_id = ?', [station_id]);
        await sleep(120000);

        const dynamicInfo = await cgbasApi.fetchDynamicInfo([station_id]);
        const stationStatus = dynamicInfo.data.find(s => s.stationId === station_id);

        if (stationStatus && stationStatus.connectStatus === 1) {
            logger.info(`[Job ${station_id}] ✅ PHỤC HỒI THÀNH CÔNG.`);
            await db.execute('DELETE FROM station_recovery_jobs WHERE station_id = ?', [station_id]);
        } else {
            // NẾU SAU 2 PHÚT VẪN CHƯA LÊN: Có thể do kích chưa ăn, ta tiếp tục reschedule để thử lại từ đầu
            logger.warn(`[Job ${station_id}] ❌ Trạm vẫn Offline sau 2 phút.`);
            return await rescheduleJob(station_id, retry_index, "Trạm không có tín hiệu sau điều khiển");
        }

    } catch (err) {
        logger.error(`[Job ${station_id}] Lỗi hệ thống: ${err.message}`);
        await rescheduleJob(station_id, retry_index, "Lỗi thực thi Code");
    }
}

module.exports = { runAutoRecovery };