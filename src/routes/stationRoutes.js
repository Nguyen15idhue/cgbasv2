const express = require('express');
const router = express.Router();
const db = require('../config/database');

// API: Lấy thông tin trạm CGBAS kèm trạng thái vệ tinh
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

module.exports = router;