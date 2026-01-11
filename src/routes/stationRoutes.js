const express = require('express');
const router = express.Router();
const db = require('../config/database');

// API: Lấy danh sách trạm với thông tin đầy đủ
router.get('/list', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                s.id,
                s.stationName,
                s.identificationName,
                s.stationType,
                s.lat,
                s.lng,
                s.ewelink_device_id,
                d.connectStatus,
                d.delay,
                d.sat_R,
                d.sat_C,
                d.sat_E,
                d.sat_G,
                d.updateTime as lastUpdate
            FROM stations s
            LEFT JOIN station_dynamic_info d ON s.id = d.stationId
            ORDER BY s.stationName ASC
        `);
        res.json({ success: true, total: rows.length, stations: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Lấy thông tin trạm CGBAS kèm trạng thái vệ tinh (legacy)
router.get('/status', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, d.connectStatus, d.delay, d.sat_R, d.sat_C, d.sat_E, d.sat_G, d.updateTime as lastDynamicUpdate
            FROM stations s
            LEFT JOIN station_dynamic_info d ON s.id = d.stationId
            ORDER BY s.stationName ASC
        `);
        res.json({ success: true, total: rows.length, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Kích hoạt phục hồi trạm
router.post('/recover', async (req, res) => {
    try {
        const { stationId, deviceId } = req.body;

        if (!stationId || !deviceId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Thiếu thông tin stationId hoặc deviceId' 
            });
        }

        // Kiểm tra xem đã có job chưa
        const [existing] = await db.execute(
            'SELECT * FROM station_recovery_jobs WHERE station_id = ?',
            [stationId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Trạm này đã có trong hàng đợi phục hồi' 
            });
        }

        // Thêm vào hàng đợi
        const nextRun = new Date(Date.now() + 2 * 60000); // 2 phút sau
        await db.execute(
            `INSERT INTO station_recovery_jobs 
            (station_id, device_id, status, retry_index, next_run_time) 
            VALUES (?, ?, 'PENDING', 0, ?)`,
            [stationId, deviceId, nextRun]
        );

        res.json({ 
            success: true, 
            message: 'Đã thêm vào hàng đợi phục hồi' 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Cập nhật ánh xạ thiết bị eWeLink cho trạm
router.post('/update-mapping', async (req, res) => {
    try {
        const { stationId, deviceId } = req.body;

        if (!stationId || !deviceId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Thiếu thông tin stationId hoặc deviceId' 
            });
        }

        await db.execute(
            'UPDATE stations SET ewelink_device_id = ? WHERE id = ?',
            [deviceId, stationId]
        );

        res.json({ 
            success: true, 
            message: 'Đã cập nhật ánh xạ thiết bị thành công' 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Lấy lịch sử phục hồi trạm
router.get('/recovery-history', async (req, res) => {
    try {
        const { stationId, status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT 
                h.*,
                s.stationName,
                s.identificationName
            FROM station_recovery_history h
            LEFT JOIN stations s ON h.station_id = s.id
            WHERE 1=1
        `;
        const params = [];

        // Filter theo station
        if (stationId) {
            query += ' AND h.station_id = ?';
            params.push(stationId);
        }

        // Filter theo status
        if (status) {
            query += ' AND h.status = ?';
            params.push(status);
        }

        query += ' ORDER BY h.completed_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.query(query, params);

        // Lấy tổng số records
        let countQuery = 'SELECT COUNT(*) as total FROM station_recovery_history h WHERE 1=1';
        const countParams = [];
        if (stationId) {
            countQuery += ' AND station_id = ?';
            countParams.push(stationId);
        }
        if (status) {
            countQuery += ' AND status = ?';
            countParams.push(status);
        }
        const [countRows] = await db.query(countQuery, countParams);

        res.json({ 
            success: true, 
            total: countRows[0].total,
            data: rows,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: countRows[0].total > parseInt(offset) + rows.length
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Lấy thống kê lịch sử phục hồi
router.get('/recovery-stats', async (req, res) => {
    try {
        // Thống kê tổng quan
        const [summary] = await db.query(`
            SELECT 
                COUNT(*) as total_attempts,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count,
                AVG(CASE WHEN status = 'SUCCESS' THEN total_duration_minutes END) as avg_success_duration,
                AVG(CASE WHEN status = 'SUCCESS' THEN retry_count END) as avg_retry_count
            FROM station_recovery_history
        `);

        // Top trạm thường xuyên offline
        const [topOffline] = await db.query(`
            SELECT 
                h.station_id,
                s.stationName,
                s.identificationName,
                COUNT(*) as offline_count,
                SUM(CASE WHEN h.status = 'SUCCESS' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN h.status = 'FAILED' THEN 1 ELSE 0 END) as failed_count
            FROM station_recovery_history h
            LEFT JOIN stations s ON h.station_id = s.id
            GROUP BY h.station_id, s.stationName, s.identificationName
            ORDER BY offline_count DESC
            LIMIT 10
        `);

        // Lịch sử 7 ngày gần nhất
        const [recentTrend] = await db.query(`
            SELECT 
                DATE(completed_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
            FROM station_recovery_history
            WHERE completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(completed_at)
            ORDER BY date DESC
        `);

        res.json({ 
            success: true, 
            summary: summary[0],
            topOfflineStations: topOffline,
            weeklyTrend: recentTrend
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;