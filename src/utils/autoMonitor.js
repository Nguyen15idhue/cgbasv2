const db = require('../config/database');
const { runAutoRecovery } = require('../services/stationControlService');

async function checkAndTriggerRecovery() {
    // 1. Quét các trạm đang Offline trên CGBAS mà CÓ gán thiết bị eWelink và CHƯA có Job
    const [offlineStations] = await db.query(`
        SELECT s.id, s.ewelink_device_id 
        FROM stations s
        JOIN station_dynamic_info d ON s.id = d.stationId
        LEFT JOIN station_recovery_jobs j ON s.id = j.station_id
        WHERE d.connectStatus = 3
        AND s.ewelink_device_id IS NOT NULL
        AND j.id IS NULL
    `);

    for (const st of offlineStations) {
        console.log(`[Monitor] Phát hiện trạm ${st.id} Offline. Tạo Job phục hồi...`);
        await db.execute(
            'INSERT INTO station_recovery_jobs (station_id, device_id, next_run_time, status) VALUES (?, ?, NOW(), "PENDING")',
            [st.id, st.ewelink_device_id]
        );
    }

    // 2. Lấy các Job đang PENDING đã đến giờ chạy
    const [jobsToRun] = await db.query(`
        SELECT * FROM station_recovery_jobs 
        WHERE status = 'PENDING' AND next_run_time <= NOW()
    `);

    for (const job of jobsToRun) {
        // Chạy Job bất đồng bộ (không await) để không làm nghẽn Scheduler
        runAutoRecovery(job); 
    }
}

module.exports = { checkAndTriggerRecovery };