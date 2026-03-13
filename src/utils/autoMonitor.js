const db = require('../config/database');
const { runAutoRecovery } = require('../services/stationControlService');
const logger = require('./logger');

// Ngưỡng thời gian cho các trạng thái khác nhau
const OFFLINE_THRESHOLD = 30;        // Status 3 (Offline): 30 giây → Tạo Job ngay
const LOST_DATA_THRESHOLD = 300;     // Status 2 (Lost Data): 5 phút → Tạo Job nếu không tự phục hồi
const RECOVERY_MAX_CONCURRENT_JOBS = 10; // Giới hạn số job recovery chạy song song để tránh dồn API
const RECOVERY_DISPATCH_LOCK = 'recovery_dispatch_lock';
const RECOVERY_STALE_TIMEOUT_MINUTES = 10; // Tự phục hồi job bị kẹt RUNNING/CHECKING

async function checkAndTriggerRecovery() {
    const now = new Date();
    
    try {
        // ===== BƯỚC 1: CẬP NHẬT TRACKING CHO TẤT CẢ TRẠM =====
        const [allStations] = await db.query(`
            SELECT d.stationId, d.connectStatus, d.first_offline_at
            FROM station_dynamic_info d
            JOIN stations s ON d.stationId = s.id
            WHERE s.ewelink_device_id IS NOT NULL
            AND s.is_active = 1
        `);
        
        for (const st of allStations) {
            if (st.connectStatus === 1) {
                // ✅ ONLINE: Reset tracking
                if (st.first_offline_at) {
                    await db.execute(
                        'UPDATE station_dynamic_info SET first_offline_at = NULL, offline_duration_seconds = 0 WHERE stationId = ?',
                        [st.stationId]
                    );
                }
            } else if (st.connectStatus === 0 || st.connectStatus === 2 || st.connectStatus === 3) {
                // ⚠️ KHÔNG BÌNH THƯỜNG (Chưa kết nối/Chưa định vị/Offline): Tích lũy thời gian
                if (!st.first_offline_at) {
                    // Lần đầu phát hiện → Ghi timestamp
                    await db.execute(
                        'UPDATE station_dynamic_info SET first_offline_at = NOW(), offline_duration_seconds = 0 WHERE stationId = ?',
                        [st.stationId]
                    );
                } else {
                    // Đã có vấn đề từ trước → Tính duration
                    const duration = Math.floor((now - new Date(st.first_offline_at)) / 1000);
                    await db.execute(
                        'UPDATE station_dynamic_info SET offline_duration_seconds = ? WHERE stationId = ?',
                        [duration, st.stationId]
                    );
                }
            }
        }
        
        // ===== BƯỚC 2: TẠO JOB CHO TRẠM ĐỦ ĐIỀU KIỆN =====
        const [eligibleStations] = await db.query(`
            SELECT s.id, s.ewelink_device_id, d.connectStatus, d.offline_duration_seconds
            FROM stations s
            JOIN station_dynamic_info d ON s.id = d.stationId
            LEFT JOIN station_recovery_jobs j ON s.id = j.station_id
            LEFT JOIN scheduled_shutdown_labels sslabel ON s.id = sslabel.station_id 
                AND sslabel.status IN ('pending', 'shutting_down', 'waiting_poweron', 'powering_on')
            WHERE s.ewelink_device_id IS NOT NULL
            AND s.is_active = 1
            AND j.id IS NULL
            AND sslabel.station_id IS NULL
            AND (
                -- Case 1: Offline hoàn toàn >= 30 giây
                (d.connectStatus = 3 AND d.offline_duration_seconds >= ?)
                OR
                -- Case 2: Lost data kéo dài >= 5 phút (không tự phục hồi)
                (d.connectStatus = 2 AND d.offline_duration_seconds >= ?)
            )
        `, [OFFLINE_THRESHOLD, LOST_DATA_THRESHOLD]);
        
        for (const st of eligibleStations) {
            const statusLabel = st.connectStatus === 3 ? 'Offline' : 'Lost Data kéo dài';
            logger.info(`[Monitor] ⚠️ Trạm ${st.id} ${statusLabel} ${st.offline_duration_seconds}s. Tạo Job phục hồi...`);
            
            await db.execute(
                'INSERT INTO station_recovery_jobs (station_id, device_id, next_run_time, status) VALUES (?, ?, NOW(), "PENDING")',
                [st.id, st.ewelink_device_id]
            );
        }
        
        // ===== BƯỚC 3: CHẠY CÁC JOB ĐANG PENDING (CÓ GIỚI HẠN ĐỒNG THỜI) =====
        // Advisory lock phải dùng cùng 1 connection để tránh lock bị treo vĩnh viễn.
        const lockConn = await db.getConnection();
        let lockAcquired = false;
        const claimedJobs = [];

        try {
            const [lockRows] = await lockConn.execute('SELECT GET_LOCK(?, 0) as lock_ok', [RECOVERY_DISPATCH_LOCK]);
            lockAcquired = Number(lockRows?.[0]?.lock_ok || 0) === 1;

            if (!lockAcquired) {
                return;
            }

            // Tự động phục hồi job bị kẹt để tránh full slot giả.
            const [staleFix] = await lockConn.execute(
                `UPDATE station_recovery_jobs
                 SET status = 'PENDING', next_run_time = NOW()
                 WHERE status IN ('RUNNING', 'CHECKING')
                 AND updated_at < NOW() - INTERVAL ${RECOVERY_STALE_TIMEOUT_MINUTES} MINUTE`
            );

            if ((staleFix?.affectedRows || 0) > 0) {
                logger.warn(`[Monitor] Đã reset ${staleFix.affectedRows} job bị kẹt RUNNING/CHECKING > ${RECOVERY_STALE_TIMEOUT_MINUTES} phút.`);
            }

            const [activeJobs] = await lockConn.query(`
                SELECT COUNT(*) as total
                FROM station_recovery_jobs
                WHERE status IN ('RUNNING', 'CHECKING')
            `);

            const runningCount = activeJobs[0]?.total || 0;
            const availableSlots = Math.max(0, RECOVERY_MAX_CONCURRENT_JOBS - runningCount);

            if (availableSlots <= 0) {
                return;
            }

            const [jobsToRun] = await lockConn.query(`
                SELECT * FROM station_recovery_jobs
                WHERE status = 'PENDING' AND next_run_time <= NOW()
                ORDER BY next_run_time ASC
                LIMIT ${availableSlots}
            `);

            for (const job of jobsToRun) {
                // Claim job trước khi chạy để tránh scheduler kế tiếp lấy trùng.
                const [claimResult] = await lockConn.execute(
                    'UPDATE station_recovery_jobs SET status = "RUNNING" WHERE id = ? AND status = "PENDING"',
                    [job.id]
                );

                if (claimResult.affectedRows === 0) {
                    continue;
                }

                claimedJobs.push(job);
            }
        } finally {
            try {
                if (lockAcquired) {
                    await lockConn.execute('SELECT RELEASE_LOCK(?)', [RECOVERY_DISPATCH_LOCK]);
                }
            } finally {
                lockConn.release();
            }
        }

        // Chạy bất đồng bộ ngoài lock để giảm thời gian giữ lock.
        for (const job of claimedJobs) {
            runAutoRecovery(job).catch((err) => {
                logger.error(`[Monitor] Lỗi chạy job recovery ${job.id}: ${err.message}`);
            });
        }
        
    } catch (error) {
        logger.error(`[Monitor] Lỗi checkAndTriggerRecovery: ${error.message}`);
    }
}

module.exports = { checkAndTriggerRecovery };