const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ewelinkService = require('../services/ewelinkService');
const { turnOnStation, turnOffStation } = require('../services/stationControlService');

// API: Lấy danh sách thiết bị eWelink từ DB
router.get('/devices', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT d.*, s.switch_0, s.switch_1, s.voltage_0, s.updateTime as lastStatusUpdate
            FROM ewelink_devices d
            LEFT JOIN ewelink_status s ON d.deviceid = s.deviceid
        `);
        res.json({ success: true, total: rows.length, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Điều khiển Bật/Tắt lẻ từng kênh
router.post('/control', async (req, res) => {
    const { deviceid, channel, action } = req.body;
    if (!deviceid || !channel || !action) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin điều khiển" });
    }
    try {
        const outlet = (parseInt(channel) === 1) ? 0 : 1;
        const result = await ewelinkService.toggleChannel(deviceid, outlet, action);
        if (result.error === 0) {
            const field = (outlet === 0) ? 'switch_0' : 'switch_1';
            await db.execute(`UPDATE ewelink_status SET ${field} = ? WHERE deviceid = ?`, [action, deviceid]);
            res.json({ success: true, message: `Kênh ${channel} đã chuyển sang ${action}` });
        } else {
            res.status(400).json({ success: false, message: result.msg || "Lỗi từ eWelink" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Bật trạm theo kịch bản (Retry 5 lần)
router.post('/station-on', async (req, res) => {
    const { deviceid } = req.body;
    if (!deviceid) return res.status(400).json({ success: false, message: "Thiếu deviceid" });
    const result = await turnOnStation(deviceid);
    if (result.success) res.json(result);
    else res.status(500).json(result);
});

// API: Tắt trạm theo kịch bản (Retry 5 lần)
router.post('/station-off', async (req, res) => {
    const { deviceid } = req.body;
    if (!deviceid) return res.status(400).json({ success: false, message: "Thiếu deviceid" });
    const result = await turnOffStation(deviceid);
    if (result.success) res.json(result);
    else res.status(500).json(result);
});

// API: Thống kê sử dụng API eWelink
router.get('/api-stats', async (req, res) => {
    try {
        // 1. Tổng số lần gọi
        const [total] = await db.query('SELECT COUNT(*) as total FROM ewelink_api_logs');
        
        // 2. Thống kê theo ngày (7 ngày gần nhất)
        const [daily] = await db.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM ewelink_api_logs 
            GROUP BY DATE(created_at) 
            ORDER BY date DESC LIMIT 7
        `);

        // 3. 20 bản ghi lịch sử mới nhất
        const [history] = await db.query('SELECT * FROM ewelink_api_logs ORDER BY created_at DESC LIMIT 20');

        res.json({
            success: true,
            summary: {
                total_calls: total[0].total,
                daily_stats: daily
            },
            history: history
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;