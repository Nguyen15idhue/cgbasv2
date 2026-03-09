const express = require('express');
const router = express.Router();
const scheduledShutdownService = require('../services/scheduledShutdownService');
const logger = require('../utils/logger');

/**
 * GET /api/scheduled-shutdown/config
 * Lấy cấu hình hiện tại
 */
router.get('/config', async (req, res) => {
    try {
        const config = await scheduledShutdownService.getConfig();
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        logger.error('[API ScheduledShutdown] Lỗi lấy config: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy cấu hình',
            error: error.message
        });
    }
});

/**
 * PUT /api/scheduled-shutdown/config
 * Cập nhật cấu hình
 */
router.put('/config', async (req, res) => {
    try {
        const { shutdown_time, shutdown_duration_minutes, batch_size, batch_delay_seconds, is_enabled } = req.body;
        
        // Validation
        if (!shutdown_time || !shutdown_duration_minutes || !batch_size || !batch_delay_seconds) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin cấu hình'
            });
        }
        
        // Validate time format HH:MM:SS
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
        if (!timeRegex.test(shutdown_time)) {
            return res.status(400).json({
                success: false,
                message: 'Định dạng thời gian không hợp lệ (HH:MM:SS)'
            });
        }
        
        // Validate numbers
        if (shutdown_duration_minutes < 1 || shutdown_duration_minutes > 60) {
            return res.status(400).json({
                success: false,
                message: 'Thời gian tắt phải từ 1-60 phút'
            });
        }
        
        if (batch_size < 1 || batch_size > 20) {
            return res.status(400).json({
                success: false,
                message: 'Batch size phải từ 1-20'
            });
        }
        
        if (batch_delay_seconds < 5 || batch_delay_seconds > 60) {
            return res.status(400).json({
                success: false,
                message: 'Batch delay phải từ 5-60 giây'
            });
        }
        
        const result = await scheduledShutdownService.updateConfig({
            shutdown_time,
            shutdown_duration_minutes: parseInt(shutdown_duration_minutes),
            batch_size: parseInt(batch_size),
            batch_delay_seconds: parseInt(batch_delay_seconds),
            is_enabled: is_enabled !== undefined ? Boolean(is_enabled) : true
        });
        
        if (result) {
            res.json({
                success: true,
                message: 'Cập nhật cấu hình thành công'
            });
        } else {
            throw new Error('Không thể cập nhật cấu hình');
        }
    } catch (error) {
        logger.error('[API ScheduledShutdown] Lỗi cập nhật config: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi cập nhật cấu hình',
            error: error.message
        });
    }
});

/**
 * GET /api/scheduled-shutdown/status
 * Lấy trạng thái hiện tại và lịch sử
 */
router.get('/status', async (req, res) => {
    try {
        const status = await scheduledShutdownService.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        logger.error('[API ScheduledShutdown] Lỗi lấy status: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy trạng thái',
            error: error.message
        });
    }
});

/**
 * POST /api/scheduled-shutdown/execute
 * Thực thi thủ công (test)
 */
router.post('/execute', async (req, res) => {
    try {
        if (scheduledShutdownService.isRunning) {
            return res.status(400).json({
                success: false,
                message: 'Quy trình đang chạy, vui lòng đợi'
            });
        }
        
        // Chạy bất đồng bộ
        scheduledShutdownService.execute().catch(err => {
            logger.error('[API ScheduledShutdown] Lỗi execute: ' + err.message);
        });
        
        res.json({
            success: true,
            message: 'Đã bắt đầu quy trình tắt/bật trạm'
        });
    } catch (error) {
        logger.error('[API ScheduledShutdown] Lỗi execute: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi thực thi',
            error: error.message
        });
    }
});

/**
 * POST /api/scheduled-shutdown/cancel
 * Hủy quy trình đang chạy
 */
router.post('/cancel', async (req, res) => {
    try {
        const result = await scheduledShutdownService.cancel();
        
        if (result) {
            res.json({
                success: true,
                message: 'Đã hủy quy trình thành công'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Không có quy trình nào đang chạy'
            });
        }
    } catch (error) {
        logger.error('[API ScheduledShutdown] Lỗi cancel: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi hủy quy trình',
            error: error.message
        });
    }
});

/**
 * GET /api/scheduled-shutdown/stations
 * Lấy danh sách trạm theo status
 */
router.get('/stations', async (req, res) => {
    try {
        const { status } = req.query;
        const stations = await scheduledShutdownService.getStationsByStatus(status);
        
        res.json({
            success: true,
            data: stations
        });
    } catch (error) {
        logger.error('[API ScheduledShutdown] Lỗi lấy danh sách trạm: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy danh sách trạm',
            error: error.message
        });
    }
});

/**
 * GET /api/scheduled-shutdown/history
 * Lấy lịch sử với phân trang
 */
router.get('/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const history = await scheduledShutdownService.getHistory(page, limit);
        
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        logger.error('[API ScheduledShutdown] Lỗi lấy lịch sử: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy lịch sử',
            error: error.message
        });
    }
});

module.exports = router;
