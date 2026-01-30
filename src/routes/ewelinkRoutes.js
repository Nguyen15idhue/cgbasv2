const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ewelinkService = require('../services/ewelinkService');
const { turnOnStation, turnOffStation } = require('../services/stationControlService');

// API: Lấy danh sách thiết bị eWelink từ DB (có pagination)
router.get('/devices', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 20;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        // Build search condition
        let searchCondition = '';
        let searchParams = [];
        if (search) {
            searchCondition = 'WHERE d.name LIKE ? OR d.deviceid LIKE ?';
            const searchPattern = `%${search}%`;
            searchParams = [searchPattern, searchPattern];
        }

        // Get total count
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM ewelink_devices d ${searchCondition}`,
            searchParams
        );
        const total = countResult[0].total;

        // Get data - if limit is 0 or 'all', get all records
        let query = `
            SELECT d.*, s.switch_0, s.switch_1, s.voltage_0, s.updateTime as lastStatusUpdate
            FROM ewelink_devices d
            LEFT JOIN ewelink_status s ON d.deviceid = s.deviceid
            ${searchCondition}
            ORDER BY d.name ASC
        `;
        
        let queryParams = [...searchParams];
        
        // Add pagination only if limit > 0
        if (limit > 0) {
            query += ` LIMIT ? OFFSET ?`;
            queryParams.push(limit, offset);
        }
        
        const [rows] = await db.query(query, queryParams);

        res.json({ 
            success: true, 
            total: total,
            page: limit > 0 ? page : 1,
            limit: limit > 0 ? limit : total,
            totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
            data: rows 
        });
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

// API: Thống kê sử dụng API eWelink (có pagination cho history)
router.get('/api-stats', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // 1. Tổng số lần gọi
        const [total] = await db.query('SELECT COUNT(*) as total FROM ewelink_api_logs');
        
        // 2. Thống kê theo ngày (7 ngày gần nhất)
        const [daily] = await db.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM ewelink_api_logs 
            GROUP BY DATE(created_at) 
            ORDER BY date DESC LIMIT 7
        `);

        // 3. Lấy logs có pagination với device name
        const [history] = await db.query(`
            SELECT 
                l.*,
                d.name as device_name
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
            ORDER BY l.created_at DESC 
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({
            success: true,
            summary: {
                total_calls: total[0].total,
                daily_stats: daily
            },
            history: history,
            pagination: {
                page: page,
                limit: limit,
                total: total[0].total,
                totalPages: Math.ceil(total[0].total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Xem token hiện tại (chỉ hiển thị một phần cho bảo mật)
router.get('/token-info', async (req, res) => {
    try {
        const tokens = ewelinkService.getCurrentTokens();
        res.json({
            success: true,
            data: {
                accessToken: tokens.accessToken ? `${tokens.accessToken.substring(0, 10)}...${tokens.accessToken.slice(-10)}` : 'N/A',
                refreshToken: tokens.refreshToken ? `${tokens.refreshToken.substring(0, 10)}...${tokens.refreshToken.slice(-10)}` : 'N/A',
                note: 'Token được tự động làm mới khi hết hạn'
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Force refresh token ngay lập tức
router.post('/refresh-token', async (req, res) => {
    try {
        const result = await ewelinkService.forceRefreshToken();
        res.json({
            success: true,
            message: 'Token đã được làm mới thành công',
            data: {
                newAccessToken: `${result.at.substring(0, 10)}...${result.at.slice(-10)}`,
                newRefreshToken: `${result.rt.substring(0, 10)}...${result.rt.slice(-10)}`,
                note: 'Vui lòng cập nhật token mới vào file .env để lưu vĩnh viễn'
            }
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: 'Không thể làm mới token: ' + err.message,
            note: 'Token có thể đã hết hạn hoàn toàn. Vui lòng lấy token mới từ eWelink app.'
        });
    }
});

// API: Đồng bộ thiết bị mới từ eWeLink (không update existing)
router.post('/sync-devices', async (req, res) => {
    try {
        // Get all devices from eWeLink API
        const result = await ewelinkService.getAllThings();
        
        if (result.error !== 0) {
            return res.status(500).json({ 
                success: false, 
                message: 'Lỗi khi lấy dữ liệu từ eWeLink: ' + result.msg 
            });
        }

        const devices = result.data.thingList || [];
        let addedCount = 0;
        let updatedStatusCount = 0;
        let existingCount = 0;

        for (const thing of devices) {
            const deviceData = thing.itemData;
            
            // Check if device exists
            const [existing] = await db.execute(
                'SELECT deviceid FROM ewelink_devices WHERE deviceid = ?',
                [deviceData.deviceid]
            );

            if (existing.length === 0) {
                // Insert new device
                await db.execute(
                    `INSERT INTO ewelink_devices 
                    (deviceid, name, model, online, familyid, apikey) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        deviceData.deviceid,
                        deviceData.name,
                        deviceData.extra?.model || 'Unknown',
                        deviceData.online || false,
                        thing.index?.familyid || '',
                        deviceData.apikey || ''
                    ]
                );

                // Insert status
                const switches = deviceData.params?.switches || [];
                const sw0 = switches.find(s => s.outlet === 0)?.switch || 'off';
                const sw1 = switches.find(s => s.outlet === 1)?.switch || 'off';

                await db.execute(
                    `INSERT INTO ewelink_status 
                    (deviceid, switch_0, switch_1, voltage_0, current_0, actPow_0) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        deviceData.deviceid,
                        sw0,
                        sw1,
                        deviceData.params?.voltage_0 || 0,
                        deviceData.params?.current_0 || 0,
                        deviceData.params?.actPow_0 || 0
                    ]
                );

                addedCount++;
            } else {
                // Chỉ update status (online/offline), không update tên hay thông tin khác
                await db.execute(
                    'UPDATE ewelink_devices SET online = ? WHERE deviceid = ?',
                    [deviceData.online || false, deviceData.deviceid]
                );

                // Update status switches
                const switches = deviceData.params?.switches || [];
                const sw0 = switches.find(s => s.outlet === 0)?.switch || 'off';
                const sw1 = switches.find(s => s.outlet === 1)?.switch || 'off';

                await db.execute(
                    `UPDATE ewelink_status 
                    SET switch_0 = ?, switch_1 = ?, voltage_0 = ?, current_0 = ?, actPow_0 = ? 
                    WHERE deviceid = ?`,
                    [
                        sw0,
                        sw1,
                        deviceData.params?.voltage_0 || 0,
                        deviceData.params?.current_0 || 0,
                        deviceData.params?.actPow_0 || 0,
                        deviceData.deviceid
                    ]
                );

                updatedStatusCount++;
                existingCount++;
            }
        }

        res.json({ 
            success: true, 
            message: `Đồng bộ thành công. Thêm mới: ${addedCount}, Cập nhật trạng thái: ${updatedStatusCount}`,
            addedCount,
            updatedStatusCount,
            existingCount,
            totalScanned: devices.length
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;