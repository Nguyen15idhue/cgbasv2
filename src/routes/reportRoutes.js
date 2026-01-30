const express = require('express');
const router = express.Router();
const db = require('../config/database');

// API: Thống kê số lượng API eWeLink theo khoảng thời gian
router.get('/summary', async (req, res) => {
    try {
        const period = req.query.period || 'day'; // day, month, year
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        let groupBy = '';
        let selectDate = '';
        let dateCondition = '';
        let dateParams = [];

        // Xác định group by và format date dựa trên period
        switch (period) {
            case 'day':
                groupBy = 'DATE(created_at)';
                selectDate = 'DATE(created_at) as date';
                break;
            case 'month':
                groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
                selectDate = 'DATE_FORMAT(created_at, "%Y-%m") as date';
                break;
            case 'year':
                groupBy = 'YEAR(created_at)';
                selectDate = 'YEAR(created_at) as date';
                break;
            default:
                return res.status(400).json({ 
                    success: false, 
                    message: 'Period không hợp lệ. Sử dụng: day, month, hoặc year' 
                });
        }

        // Tạo điều kiện lọc theo khoảng thời gian nếu có
        if (startDate && endDate) {
            dateCondition = 'WHERE DATE(created_at) BETWEEN ? AND ?';
            dateParams = [startDate, endDate];
        } else if (startDate) {
            dateCondition = 'WHERE DATE(created_at) >= ?';
            dateParams = [startDate];
        } else if (endDate) {
            dateCondition = 'WHERE DATE(created_at) <= ?';
            dateParams = [endDate];
        }

        // Lấy thống kê chi tiết theo period
        const [details] = await db.query(`
            SELECT 
                ${selectDate},
                COUNT(*) as total_calls,
                COUNT(DISTINCT endpoint) as unique_endpoints,
                COUNT(CASE WHEN response_code BETWEEN 200 AND 299 THEN 1 END) as success_calls,
                COUNT(CASE WHEN response_code >= 400 THEN 1 END) as error_calls,
                ROUND(AVG(duration_ms), 2) as avg_duration_ms,
                MIN(created_at) as first_call,
                MAX(created_at) as last_call
            FROM ewelink_api_logs
            ${dateCondition}
            GROUP BY ${groupBy}
            ORDER BY ${groupBy} DESC
            LIMIT 100
        `, dateParams);

        // Lấy thống kê tổng quan
        const [summary] = await db.query(`
            SELECT 
                COUNT(*) as total_calls,
                COUNT(CASE WHEN response_code BETWEEN 200 AND 299 THEN 1 END) as total_success,
                COUNT(CASE WHEN response_code >= 400 THEN 1 END) as total_errors,
                ROUND(AVG(duration_ms), 2) as avg_duration,
                MIN(created_at) as first_call_ever,
                MAX(created_at) as last_call_ever
            FROM ewelink_api_logs
            ${dateCondition}
        `, dateParams);

        // Lấy top endpoints được gọi nhiều nhất
        const [topEndpoints] = await db.query(`
            SELECT 
                endpoint,
                method,
                COUNT(*) as count,
                ROUND(AVG(duration_ms), 2) as avg_duration
            FROM ewelink_api_logs
            ${dateCondition}
            GROUP BY endpoint, method
            ORDER BY count DESC
            LIMIT 10
        `, dateParams);

        res.json({
            success: true,
            period: period,
            filters: {
                startDate: startDate || null,
                endDate: endDate || null
            },
            summary: summary[0] || {
                total_calls: 0,
                total_success: 0,
                total_errors: 0,
                avg_duration: 0,
                first_call_ever: null,
                last_call_ever: null
            },
            details: details,
            topEndpoints: topEndpoints
        });
    } catch (error) {
        console.error('Error loading report summary:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Lấy chi tiết logs theo device (cho biểu đồ/phân tích)
router.get('/by-device', async (req, res) => {
    try {
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        let dateCondition = '';
        let dateParams = [];

        if (startDate && endDate) {
            dateCondition = 'WHERE DATE(l.created_at) BETWEEN ? AND ?';
            dateParams = [startDate, endDate];
        }

        const [results] = await db.query(`
            SELECT 
                d.deviceid,
                d.name as device_name,
                COUNT(*) as total_calls,
                COUNT(CASE WHEN l.response_code BETWEEN 200 AND 299 THEN 1 END) as success_calls,
                COUNT(CASE WHEN l.response_code >= 400 THEN 1 END) as error_calls,
                MAX(l.created_at) as last_call
            FROM ewelink_api_logs l
            LEFT JOIN ewelink_devices d ON (
                l.payload IS NOT NULL 
                AND l.payload != ''
                AND JSON_VALID(l.payload) = 1
                AND (
                    JSON_UNQUOTE(JSON_EXTRACT(l.payload, '$.id')) = d.deviceid OR
                    JSON_UNQUOTE(JSON_EXTRACT(l.payload, '$.deviceid')) = d.deviceid
                )
            )
            ${dateCondition}
            GROUP BY d.deviceid, d.name
            ORDER BY total_calls DESC
            LIMIT 50
        `, dateParams);

        res.json({
            success: true,
            filters: {
                startDate: startDate || null,
                endDate: endDate || null
            },
            devices: results
        });
    } catch (error) {
        console.error('Error loading device report:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
