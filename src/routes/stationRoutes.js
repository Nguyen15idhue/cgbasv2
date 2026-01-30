const express = require('express');
const router = express.Router();
const db = require('../config/database');

// API: Lấy danh sách trạm với thông tin đầy đủ (có pagination)
router.get('/list', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        // Build search condition
        let searchCondition = '';
        let searchParams = [];
        if (search) {
            searchCondition = 'WHERE s.stationName LIKE ? OR s.identificationName LIKE ? OR s.id LIKE ?';
            const searchPattern = `%${search}%`;
            searchParams = [searchPattern, searchPattern, searchPattern];
        }

        // Get total count
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM stations s ${searchCondition}`,
            searchParams
        );
        const total = countResult[0].total;

        // Get paginated data
        const [rows] = await db.query(`
            SELECT 
                s.id,
                s.stationName,
                s.identificationName,
                s.stationType,
                s.lat,
                s.lng,
                s.ewelink_device_id,
                s.is_active,
                d.connectStatus,
                d.delay,
                d.sat_R,
                d.sat_C,
                d.sat_E,
                d.sat_G,
                d.updateTime as lastUpdate
            FROM stations s
            LEFT JOIN station_dynamic_info d ON s.id = d.stationId
            ${searchCondition}
            ORDER BY s.stationName ASC
            LIMIT ? OFFSET ?
        `, [...searchParams, limit, offset]);

        res.json({ 
            success: true, 
            total: total,
            page: page,
            limit: limit,
            totalPages: Math.ceil(total / limit),
            stations: rows 
        });
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

// API: Xóa ánh xạ thiết bị eWeLink cho trạm
// API: Xóa ánh xạ thiết bị của trạm
router.delete('/mapping/:stationId', async (req, res) => {
    try {
        const { stationId } = req.params;

        if (!stationId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Thiếu thông tin stationId' 
            });
        }

        // Kiểm tra trạm có tồn tại không
        const [station] = await db.execute(
            'SELECT id, stationName, ewelink_device_id FROM stations WHERE id = ?',
            [stationId]
        );

        if (station.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy trạm' 
            });
        }

        if (!station[0].ewelink_device_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Trạm này chưa có ánh xạ thiết bị' 
            });
        }

        // Xóa ánh xạ
        await db.execute(
            'UPDATE stations SET ewelink_device_id = NULL WHERE id = ?',
            [stationId]
        );

        res.json({ 
            success: true, 
            message: 'Đã xóa ánh xạ thiết bị thành công' 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Toggle enable/disable một trạm
router.post('/toggle-status/:stationId', async (req, res) => {
    try {
        const { stationId } = req.params;

        if (!stationId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Thiếu thông tin stationId' 
            });
        }

        // Get current status
        const [station] = await db.execute(
            'SELECT is_active FROM stations WHERE id = ?',
            [stationId]
        );

        if (station.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy trạm' 
            });
        }

        const newStatus = station[0].is_active === 1 ? 0 : 1;

        // Update status
        await db.execute(
            'UPDATE stations SET is_active = ? WHERE id = ?',
            [newStatus, stationId]
        );

        res.json({ 
            success: true, 
            message: `Đã ${newStatus === 1 ? 'kích hoạt' : 'vô hiệu hóa'} trạm thành công`,
            newStatus: newStatus
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Enable/Disable all stations
router.post('/toggle-all', async (req, res) => {
    try {
        const { action } = req.body; // action: 'enable' or 'disable'

        if (!action || !['enable', 'disable'].includes(action)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Action phải là "enable" hoặc "disable"' 
            });
        }

        const newStatus = action === 'enable' ? 1 : 0;

        const [result] = await db.execute(
            'UPDATE stations SET is_active = ?',
            [newStatus]
        );

        res.json({ 
            success: true, 
            message: `Đã ${action === 'enable' ? 'kích hoạt' : 'vô hiệu hóa'} ${result.affectedRows} trạm`,
            affectedRows: result.affectedRows
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Đồng bộ danh sách trạm mới từ CGBAS (không update mapping)
router.post('/sync', async (req, res) => {
    const cgbasApi = require('../services/cgbasApi');
    const logger = require('../utils/logger');
    
    try {
        // Get stations from CGBAS API
        logger.info('[Sync Stations] Fetching stations from CGBAS...');
        const result = await cgbasApi.fetchStations(1, 9999);
        
        logger.info('[Sync Stations] CGBAS Response:', JSON.stringify(result).substring(0, 200));
        
        // Check for errors in response
        if (!result) {
            return res.status(500).json({ 
                success: false, 
                message: 'Không nhận được phản hồi từ CGBAS API'
            });
        }
        
        if (result.error && result.error !== 0) {
            return res.status(500).json({ 
                success: false, 
                message: 'Lỗi từ CGBAS: ' + (result.msg || result.message || 'Lỗi không xác định')
            });
        }
        
        if (!result.stationList || !Array.isArray(result.stationList)) {
            return res.status(500).json({ 
                success: false, 
                message: 'Dữ liệu trả về từ CGBAS không hợp lệ (thiếu stationList)'
            });
        }

        const stations = result.stationList;
        logger.info(`[Sync Stations] Found ${stations.length} stations from CGBAS`);
        
        let addedCount = 0;
        let existingCount = 0;

        // Insert only new stations (không update existing)
        for (const station of stations) {
            // Check if exists
            const [existing] = await db.execute(
                'SELECT id FROM stations WHERE id = ?',
                [station.id]
            );

            if (existing.length === 0) {
                // Insert new station
                await db.execute(
                    `INSERT INTO stations 
                    (id, stationName, identificationName, stationType, receiverType, 
                     antennaType, antennaHigh, lat, lng, status, createTime, updateTime) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        station.id,
                        station.stationName,
                        station.identificationName,
                        station.stationType,
                        station.receiverType || '',
                        station.antennaType || '',
                        station.antennaHigh || 0,
                        station.lat,
                        station.lng,
                        station.status,
                        station.createTime,
                        station.updateTime
                    ]
                );
                addedCount++;
            } else {
                existingCount++;
            }
        }

        logger.info(`[Sync Stations] Completed. Added: ${addedCount}, Existing: ${existingCount}`);
        
        res.json({ 
            success: true, 
            message: `Đồng bộ thành công. Thêm mới: ${addedCount}, Đã tồn tại: ${existingCount}`,
            addedCount,
            existingCount,
            totalScanned: stations.length
        });
    } catch (err) {
        logger.error('[Sync Stations] Error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Lỗi server: ' + err.message 
        });
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

// API: Lấy lịch sử phục hồi trạm (có pagination và filter)
router.get('/recovery-history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status || '';
        const offset = (page - 1) * limit;

        // Build filter condition
        let filterCondition = '';
        let filterParams = [];
        if (status) {
            filterCondition = 'WHERE h.status = ?';
            filterParams = [status];
        }

        // Get statistics
        const [statsResult] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
                ROUND(AVG(total_duration_minutes), 1) as avgDuration
            FROM station_recovery_history
        `);

        // Get total count for filtered data
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM station_recovery_history h ${filterCondition}`,
            filterParams
        );
        const total = countResult[0].total;

        // Get paginated history with station and device info
        const [rows] = await db.query(`
            SELECT 
                h.id,
                h.station_id,
                h.device_id,
                h.status,
                h.retry_count,
                h.total_duration_minutes,
                h.failure_reason,
                h.started_at,
                h.completed_at,
                s.stationName as station_name,
                s.identificationName as station_identification
            FROM station_recovery_history h
            LEFT JOIN stations s ON h.station_id = s.id
            ${filterCondition}
            ORDER BY h.completed_at DESC
            LIMIT ? OFFSET ?
        `, [...filterParams, limit, offset]);

        res.json({
            stats: statsResult[0] || { total: 0, success: 0, failed: 0, avgDuration: 0 },
            history: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error loading recovery history:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;