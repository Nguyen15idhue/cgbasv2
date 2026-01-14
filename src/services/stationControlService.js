const ewelinkService = require('./ewelinkService');
const cgbasApi = require('./cgbasApi');
const { sleep, retryAction } = require('../utils/helper');
const logger = require('../utils/logger');
const db = require('../config/database');

const RETRY_INTERVALS = [2, 5, 10, 15, 30, 60]; // Phút chờ (loại bỏ 7 phút)
const MAX_RETRIES = 6; // Giới hạn số lần thử để tránh vòng lặp vô hạn

/**
 * Kiểm tra trạng thái trạm từ Database (không gọi API CGBAS trực tiếp)
 * Dữ liệu được cập nhật từ Scheduler mỗi 5 giây
 */
async function checkStationOnlineFromDB(station_id) {
    try {
        const [rows] = await db.execute(
            'SELECT connectStatus FROM station_dynamic_info WHERE stationId = ?',
            [station_id]
        );
        return rows.length > 0 && rows[0].connectStatus === 1;
    } catch (err) {
        logger.error(`[Job ${station_id}] Lỗi check DB: ${err.message}`);
        return false;
    }
}

/**
 * Kết thúc job thành công và lưu lịch sử
 */
async function finishSuccess(station_id, device_id, retry_index, reason = null) {
    const message = reason || 'Hoàn thành kịch bản điều khiển';
    logger.info(`[Job ${station_id}] ✅ PHỤC HỒI THÀNH CÔNG: ${message}`);
    
    await saveToHistory(station_id, device_id, 'SUCCESS', retry_index + 1, null);
    await db.execute('DELETE FROM station_recovery_jobs WHERE station_id = ?', [station_id]);
}

/**
 * Hàm lưu lịch sử job vào bảng history trước khi xóa
 */
async function saveToHistory(station_id, device_id, status, retry_count, failure_reason = null) {
    try {
        // Lấy thông tin created_at từ job hiện tại
        const [jobs] = await db.execute(
            'SELECT created_at FROM station_recovery_jobs WHERE station_id = ?',
            [station_id]
        );
        
        const started_at = jobs.length > 0 ? jobs[0].created_at : new Date();
        const completed_at = new Date();
        const duration_minutes = Math.round((completed_at - new Date(started_at)) / 60000);
        
        await db.execute(
            `INSERT INTO station_recovery_history 
            (station_id, device_id, status, retry_count, total_duration_minutes, failure_reason, started_at, completed_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [station_id, device_id, status, retry_count, duration_minutes, failure_reason, started_at, completed_at]
        );
        
        logger.info(`[Job ${station_id}] 📝 Đã lưu lịch sử: ${status} (${retry_count} lần thử, ${duration_minutes} phút)`);
    } catch (err) {
        logger.error(`[Job ${station_id}] Lỗi lưu history: ${err.message}`);
    }
}

/**
 * Hàm hỗ trợ lập lịch thử lại khi có bất kỳ lỗi nào xảy ra (Offline hoặc API Fail)
 */
async function rescheduleJob(station_id, retry_index, reason, device_id = null) {
    // Kiểm tra giới hạn số lần thử
    if (retry_index >= MAX_RETRIES) {
        logger.error(`[Job ${station_id}] 🚨 ĐÃ ĐẠT GIỚI HẠN ${MAX_RETRIES} LẦN THỬ. Đánh dấu FAILED.`);
        logger.error(`[Job ${station_id}] Lý do cuối: ${reason}`);
        
        // Lưu vào lịch sử trước khi xóa
        await saveToHistory(station_id, device_id, 'FAILED', retry_index, reason);
        
        // Xóa job khỏi queue
        await db.execute(
            'DELETE FROM station_recovery_jobs WHERE station_id = ?',
            [station_id]
        );
        
        // TODO: Gửi alert đến admin (Email/SMS/Telegram)
        return;
    }
    
    const waitMin = RETRY_INTERVALS[retry_index] || 60;
    const nextRun = new Date(Date.now() + waitMin * 60000);
    
    logger.warn(`[Job ${station_id}] ⚠️ Tạm dừng do: ${reason}. Thử lại sau ${waitMin} phút (Lần ${retry_index + 1}/${MAX_RETRIES}).`);
    
    // Alert sau lần thử thứ 3
    if (retry_index >= 2) {
        logger.error(`[Job ${station_id}] 🔔 CẢNH BÁO: Đã thử ${retry_index + 1} lần không thành công!`);
        logger.error(`[Job ${station_id}] Trạm có vấn đề nghiêm trọng. Cần kiểm tra thủ công.`);
        // TODO: Gửi cảnh báo cho admin
    }
    
    await db.execute(
        'UPDATE station_recovery_jobs SET status = "PENDING", retry_index = ?, next_run_time = ? WHERE station_id = ?',
        [retry_index + 1, nextRun, station_id]
    );
}

async function runAutoRecovery(job) {
    const { station_id, device_id, retry_index } = job;
    
    try {
        // 0. KIỂM TRA CGBAS TRƯỚC KHI BẮT ĐẦU (từ retry thứ 2 trở đi)
        if (retry_index >= 1) {
            logger.info(`[Job ${station_id}] 🔍 Kiểm tra CGBAS trước khi thực hiện (Lần thử ${retry_index + 1})...`);
            const isOnline = await checkStationOnlineFromDB(station_id);
            
            if (isOnline) {
                logger.info(`[Job ${station_id}] 🎉 Trạm đã ONLINE trên CGBAS (phát hiện trước khi gọi eWeLink)`);
                return await finishSuccess(station_id, device_id, retry_index, 'Đã online trước khi chạy');
            }
            
            logger.info(`[Job ${station_id}] Trạm vẫn OFFLINE. Tiếp tục kịch bản...`);
        }
        
        // 1. Đánh dấu đang chạy
        await db.execute('UPDATE station_recovery_jobs SET status = "RUNNING" WHERE station_id = ?', [station_id]);

        // 2. Kiểm tra thiết bị eWeLink Online
        const deviceRes = await ewelinkService.getAllThings();
        const device = deviceRes.data.thingList.find(t => t.itemData.deviceid === device_id);

        if (!device || !device.itemData.online) {
            return await rescheduleJob(station_id, retry_index, "Thiết bị eWelink Ngoại tuyến", device_id);
        }

        // 3. Kiểm tra Kênh 1 và thực hiện kịch bản
        const switches = device.itemData.params.switches || [];
        const ch1Status = switches.find(s => s.outlet === 0)?.switch;

        // --- THỰC THI LỆNH VỚI CƠ CHẾ RESCHEDULE NẾU FAIL ---
        
        // STEP 1: Bật Kênh 1 (nếu đang tắt)
        if (ch1Status === 'off') {
            // Kiểm tra CGBAS trước STEP 1 (từ retry 2+)
            if (retry_index >= 1) {
                logger.info(`[Job ${station_id}] 🔍 Kiểm tra CGBAS trước STEP 1...`);
                if (await checkStationOnlineFromDB(station_id)) {
                    return await finishSuccess(station_id, device_id, retry_index, 'Online trước STEP 1 (Bật Kênh 1)');
                }
            }
            
            logger.info(`[Job ${station_id}] STEP 1: Bật Kênh 1...`);
            const ok1 = await retryAction(() => ewelinkService.toggleChannel(device_id, 0, 'on'), "Bật Kênh 1");
            if (!ok1) return await rescheduleJob(station_id, retry_index, "Lỗi API khi Bật Kênh 1", device_id);
            
            await sleep(10000);
        }

        // STEP 2: Bật Kênh 2 (kích nút)
        // Kiểm tra CGBAS trước STEP 2 (từ retry 2+)
        if (retry_index >= 1) {
            logger.info(`[Job ${station_id}] 🔍 Kiểm tra CGBAS trước STEP 2...`);
            if (await checkStationOnlineFromDB(station_id)) {
                return await finishSuccess(station_id, device_id, retry_index, 'Online trước STEP 2 (Bật Kênh 2)');
            }
        }
        
        logger.info(`[Job ${station_id}] STEP 2: Bật Kênh 2 (kích nút)...`);
        const ok2 = await retryAction(() => ewelinkService.toggleChannel(device_id, 1, 'on'), "Bật Kênh 2");
        if (!ok2) return await rescheduleJob(station_id, retry_index, "Lỗi API khi Bật Kênh 2", device_id);
        
        await sleep(5000);
        
        // STEP 3: Tắt Kênh 2
        // Kiểm tra CGBAS trước STEP 3 (từ retry 2+)
        if (retry_index >= 1) {
            logger.info(`[Job ${station_id}] 🔍 Kiểm tra CGBAS trước STEP 3...`);
            if (await checkStationOnlineFromDB(station_id)) {
                return await finishSuccess(station_id, device_id, retry_index, 'Online trước STEP 3 (Tắt Kênh 2)');
            }
        }
        
        logger.info(`[Job ${station_id}] STEP 3: Tắt Kênh 2...`);
        const ok3 = await retryAction(() => ewelinkService.toggleChannel(device_id, 1, 'off'), "Tắt Kênh 2");
        if (!ok3) return await rescheduleJob(station_id, retry_index, "Lỗi API khi Tắt Kênh 2", device_id);

        // 4. Chờ kiểm tra kết quả cuối cùng trên CGBAS
        logger.info(`[Job ${station_id}] Điều khiển xong. Chờ 2 phút kiểm tra kết quả...`);
        await db.execute('UPDATE station_recovery_jobs SET status = "CHECKING" WHERE station_id = ?', [station_id]);
        await sleep(120000);

        // Kiểm tra kết quả từ DB (đã được Scheduler cập nhật mỗi 5s)
        const isOnline = await checkStationOnlineFromDB(station_id);
        
        if (isOnline) {
            return await finishSuccess(station_id, device_id, retry_index, null);
        } else {
            // NẾU SAU 2 PHÚT VẪN CHƯA LÊN: Có thể do kích chưa ăn, ta tiếp tục reschedule để thử lại từ đầu
            logger.warn(`[Job ${station_id}] ❌ Trạm vẫn Offline sau 2 phút kiểm tra.`);
            return await rescheduleJob(station_id, retry_index, "Trạm không có tín hiệu sau điều khiển", device_id);
        }

    } catch (err) {
        logger.error(`[Job ${station_id}] Lỗi hệ thống: ${err.message}`);
        await rescheduleJob(station_id, retry_index, "Lỗi thực thi Code", device_id);
    }
}

module.exports = { runAutoRecovery };