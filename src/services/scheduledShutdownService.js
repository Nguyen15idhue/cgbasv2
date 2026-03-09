const db = require('../config/database');
const ewelinkService = require('./ewelinkService');
const logger = require('../utils/logger');
const { sleep } = require('../utils/helper');

/**
 * DỊCH VỤ TẮT/BẬT TRẠM THEO LỊCH HÀNG NGÀY
 * 
 * Tính năng:
 * - Tắt tất cả trạm đã ánh xạ eWeLink vào 1 thời gian cố định
 * - Xử lý theo batch để tránh vượt rate limit
 * - Sử dụng nhãn (label) để theo dõi tiến trình
 * - Tự động bật lại sau x phút
 */

class ScheduledShutdownService {
    constructor() {
        this.isRunning = false;
        this.currentExecutionId = null;
        this.shouldCancel = false; // Flag để hủy quy trình
    }

    /**
     * Lấy cấu hình hiện tại từ database
     */
    async getConfig() {
        try {
            const [rows] = await db.execute('SELECT * FROM scheduled_shutdown_config WHERE id = 1');
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            logger.error('[ScheduledShutdown] Lỗi lấy config: ' + error.message);
            return null;
        }
    }

    /**
     * Cập nhật cấu hình
     */
    async updateConfig(config) {
        try {
            const { shutdown_time, shutdown_duration_minutes, batch_size, batch_delay_seconds, is_enabled } = config;
            
            await db.execute(
                `UPDATE scheduled_shutdown_config 
                SET shutdown_time = ?, 
                    shutdown_duration_minutes = ?, 
                    batch_size = ?, 
                    batch_delay_seconds = ?,
                    is_enabled = ?
                WHERE id = 1`,
                [shutdown_time, shutdown_duration_minutes, batch_size, batch_delay_seconds, is_enabled]
            );
            
            logger.info('[ScheduledShutdown] ✓ Đã cập nhật cấu hình');
            return true;
        } catch (error) {
            logger.error('[ScheduledShutdown] Lỗi cập nhật config: ' + error.message);
            return false;
        }
    }

    /**
     * Kiểm tra xem đã đến giờ thực hiện chưa
     */
    async shouldExecuteNow() {
        try {
            const config = await this.getConfig();
            if (!config || !config.is_enabled) {
                return false;
            }

            // Cleanup các execution bị stuck ở trạng thái "running" (quá 30 phút)
            await db.execute(
                "UPDATE scheduled_shutdown_history SET status = 'failed', notes = 'Timeout - auto cleanup (30min)', completed_at = NOW() WHERE status = 'running' AND started_at < NOW() - INTERVAL 30 MINUTE"
            );

            const now = new Date();
            const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
            const targetTime = config.shutdown_time;

            // Parse thời gian
            const [targetH, targetM, targetS] = targetTime.split(':').map(Number);
            const [currentH, currentM, currentS] = currentTime.split(':').map(Number);
            
            const targetSeconds = targetH * 3600 + targetM * 60 + targetS;
            const currentSeconds = currentH * 3600 + currentM * 60 + currentS;
            
            // Kiểm tra: Thời gian hiện tại ĐÃ QUA target time (nhưng không quá 12 giờ)
            const diff = currentSeconds - targetSeconds;
            
            // Chỉ trigger nếu:
            // 1. Đã qua giờ target (diff >= 0)
            // 2. Chưa quá 12 tiếng (để tránh trigger sáng hôm sau với lịch đêm hôm trước)
            const MAX_WINDOW = 12 * 3600; // 12 hours
            
            if (diff >= 0 && diff <= MAX_WINDOW) {
                const today = now.toISOString().split('T')[0];
                
                // Kiểm tra xem có execution ĐANG CHẠY không (bao gồm cả đang sleep)
                const [runningExecution] = await db.execute(
                    'SELECT id FROM scheduled_shutdown_history WHERE execution_date = ? AND status = "running"',
                    [today]
                );
                
                if (runningExecution.length > 0) {
                    // Đã có execution đang chạy (có thể đang sleep), bỏ qua
                    return false;
                }
                
                // Kiểm tra xem hôm nay đã chạy THÀNH CÔNG chưa
                const [completedExecution] = await db.execute(
                    'SELECT id FROM scheduled_shutdown_history WHERE execution_date = ? AND status = "completed"',
                    [today]
                );
                
                if (completedExecution.length === 0) {
                    logger.info(`[ScheduledShutdown] ⏰ Đến giờ thực hiện! Current: ${currentTime}, Target: ${targetTime}, Diff: ${diff}s`);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            logger.error('[ScheduledShutdown] Lỗi kiểm tra shouldExecuteNow: ' + error.message);
            return false;
        }
    }

    /**
     * Gắn nhãn cho tất cả trạm cần xử lý
     */
    async labelAllStations() {
        try {
            // Kiểm tra xem đã có nhãn chưa - nếu có thì KHÔNG XÓA (có thể là execution khác đang chạy)
            const [existingLabels] = await db.execute('SELECT COUNT(*) as count FROM scheduled_shutdown_labels');
            if (existingLabels[0].count > 0) {
                logger.warn(`[ScheduledShutdown] ⚠️ Đã có ${existingLabels[0].count} nhãn trong DB - BỎ QUA gắn nhãn (có thể execution khác đang chạy)`);
                return 0;
            }
            
            // Xóa nhãn cũ (nếu có)
            await db.execute('DELETE FROM scheduled_shutdown_labels');
            
            // Lấy tất cả trạm đã ánh xạ eWeLink và đang active
            const [stations] = await db.execute(
                'SELECT id, ewelink_device_id FROM stations WHERE ewelink_device_id IS NOT NULL AND is_active = 1'
            );
            
            if (stations.length === 0) {
                logger.warn('[ScheduledShutdown] Không có trạm nào để xử lý');
                return 0;
            }
            
            // Gắn nhãn cho tất cả trạm (INSERT từng record để tránh lỗi prepared statement)
            for (const station of stations) {
                await db.execute(
                    'INSERT INTO scheduled_shutdown_labels (station_id, labeled_at, status) VALUES (?, NOW(), ?)',
                    [station.id, 'pending']
                );
            }
            
            logger.info(`[ScheduledShutdown] ✓ Đã gắn nhãn cho ${stations.length} trạm`);
            return stations.length;
        } catch (error) {
            logger.error('[ScheduledShutdown] Lỗi gắn nhãn: ' + error.message);
            throw error;
        }
    }

    /**
     * Tắt một batch trạm
     */
    async shutdownBatch(stations) {
        const results = [];
        
        for (const station of stations) {
            try {
                logger.info(`[ScheduledShutdown] Tắt trạm ${station.station_id} (Device: ${station.device_id})...`);
                
                // Cập nhật trạng thái đang tắt
                await db.execute(
                    'UPDATE scheduled_shutdown_labels SET status = "shutting_down" WHERE station_id = ?',
                    [station.station_id]
                );
                
                // Gọi eWeLink API để tắt thiết bị (outlet = 0 cho kênh mặc định)
                const result = await ewelinkService.toggleChannel(station.device_id, 0, 'off');
                
                if (result.error === 0) {
                    // Thành công
                    await db.execute(
                        'UPDATE scheduled_shutdown_labels SET status = "waiting_poweron", shutdown_completed_at = NOW() WHERE station_id = ?',
                        [station.station_id]
                    );
                    logger.info(`[ScheduledShutdown] ✓ Đã tắt trạm ${station.station_id}`);
                    results.push({ station_id: station.station_id, success: true });
                } else {
                    throw new Error(result.msg || 'Unknown error');
                }
                
            } catch (error) {
                logger.error(`[ScheduledShutdown] ✗ Lỗi tắt trạm ${station.station_id}: ${error.message}`);
                
                await db.execute(
                    'UPDATE scheduled_shutdown_labels SET status = "failed", error_message = ? WHERE station_id = ?',
                    [error.message, station.station_id]
                );
                
                results.push({ station_id: station.station_id, success: false, error: error.message });
            }
        }
        
        return results;
    }

    /**
     * Bật một batch trạm
     */
    async poweronBatch(stations) {
        const results = [];
        
        for (const station of stations) {
            try {
                logger.info(`[ScheduledShutdown] Bật trạm ${station.station_id} (Device: ${station.device_id})...`);
                
                // Cập nhật trạng thái đang bật
                await db.execute(
                    'UPDATE scheduled_shutdown_labels SET status = "powering_on" WHERE station_id = ?',
                    [station.station_id]
                );
                
                // Gọi eWeLink API để bật thiết bị (outlet = 0 cho kênh mặc định)
                const result = await ewelinkService.toggleChannel(station.device_id, 0, 'on');
                
                if (result.error === 0) {
                    // Thành công - xóa nhãn
                    await db.execute(
                        'UPDATE scheduled_shutdown_labels SET status = "completed", poweron_completed_at = NOW() WHERE station_id = ?',
                        [station.station_id]
                    );
                    logger.info(`[ScheduledShutdown] ✓ Đã bật trạm ${station.station_id}`);
                    results.push({ station_id: station.station_id, success: true });
                } else {
                    throw new Error(result.msg || 'Unknown error');
                }
                
            } catch (error) {
                logger.error(`[ScheduledShutdown] ✗ Lỗi bật trạm ${station.station_id}: ${error.message}`);
                
                await db.execute(
                    'UPDATE scheduled_shutdown_labels SET status = "failed", error_message = ? WHERE station_id = ?',
                    [error.message, station.station_id]
                );
                
                results.push({ station_id: station.station_id, success: false, error: error.message });
            }
        }
        
        return results;
    }

    /**
     * Thực thi quy trình tắt/bật toàn bộ
     */
    async execute() {
        if (this.isRunning) {
            logger.warn('[ScheduledShutdown] Đang chạy, bỏ qua lần này');
            return;
        }

        this.isRunning = true;
        this.shouldCancel = false; // Reset flag
        
        try {
            logger.info('[ScheduledShutdown] ========== BẮT ĐẦU QUY TRÌNH TẮT/BẬT TRẠM ==========');
            
            const config = await this.getConfig();
            if (!config || !config.is_enabled) {
                logger.warn('[ScheduledShutdown] Tính năng đã tắt hoặc chưa cấu hình');
                return;
            }
            
            const today = new Date().toISOString().split('T')[0];
            
            // Tạo bản ghi lịch sử
            const [result] = await db.execute(
                'INSERT INTO scheduled_shutdown_history (execution_date, started_at, status) VALUES (?, NOW(), "running")',
                [today]
            );
            this.currentExecutionId = result.insertId;
            
            // BƯỚC 1: Gắn nhãn cho tất cả trạm
            logger.info('[ScheduledShutdown] BƯỚC 1: Gắn nhãn cho tất cả trạm...');
            const totalStations = await this.labelAllStations();
            
            await db.execute(
                'UPDATE scheduled_shutdown_history SET total_stations = ? WHERE id = ?',
                [totalStations, this.currentExecutionId]
            );
            
            if (totalStations === 0) {
                await db.execute(
                    'UPDATE scheduled_shutdown_history SET status = "completed", completed_at = NOW() WHERE id = ?',
                    [this.currentExecutionId]
                );
                return;
            }
            
            // BƯỚC 2: Tắt tất cả trạm theo batch
            logger.info(`[ScheduledShutdown] BƯỚC 2: Tắt ${totalStations} trạm (batch size: ${config.batch_size})...`);
            
            let offset = 0;
            let successCount = 0;
            let failCount = 0;
            
            while (true) {
                // Kiểm tra yêu cầu hủy
                if (this.shouldCancel) {
                    logger.warn('[ScheduledShutdown] ⚠️ ĐÃ HỦY QUY TRÌNH');
                    // Xóa labels ngay khi hủy
                    await db.execute('DELETE FROM scheduled_shutdown_labels');
                    logger.info('[ScheduledShutdown] ✓ Đã xóa tất cả labels (sau hủy)');
                    return; // Thoát khỏi execute()
                }
                
                // Lấy batch trạm có nhãn 'pending' hoặc 'shutting_down'
                const batchLimit = parseInt(config.batch_size) || 5;
                const [batch] = await db.query(
                    `SELECT sl.station_id, s.ewelink_device_id as device_id 
                     FROM scheduled_shutdown_labels sl 
                     JOIN stations s ON sl.station_id = s.id 
                     WHERE sl.status IN ('pending', 'shutting_down') 
                     LIMIT ${batchLimit}`
                );
                
                if (batch.length === 0) break;
                
                logger.info(`[ScheduledShutdown] Xử lý batch: ${batch.length} trạm...`);
                const results = await this.shutdownBatch(batch);
                
                // Đếm kết quả
                results.forEach(r => r.success ? successCount++ : failCount++);
                
                // Delay giữa các batch
                if (batch.length === config.batch_size) {
                    logger.info(`[ScheduledShutdown] Chờ ${config.batch_delay_seconds}s trước batch tiếp...`);
                    await sleep(config.batch_delay_seconds * 1000);
                }
            }
            
            logger.info(`[ScheduledShutdown] ✓ Hoàn thành tắt: ${successCount} thành công, ${failCount} thất bại`);
            
            // Kiểm tra hủy trước khi sleep
            if (this.shouldCancel) {
                logger.warn('[ScheduledShutdown] ⚠️ ĐÃ HỦY trước khi chờ');
                // Xóa labels ngay khi hủy
                await db.execute('DELETE FROM scheduled_shutdown_labels');
                logger.info('[ScheduledShutdown] ✓ Đã xóa tất cả labels (sau hủy)');
                return;
            }
            
            // BƯỚC 3: Chờ x phút
            logger.info(`[ScheduledShutdown] BƯỚC 3: Chờ ${config.shutdown_duration_minutes} phút trước khi bật lại...`);
            await sleep(config.shutdown_duration_minutes * 60 * 1000);
            
            // BƯỚC 4: Bật lại tất cả trạm theo batch
            logger.info(`[ScheduledShutdown] BƯỚC 4: Bật lại trạm...`);
            
            while (true) {
                // Kiểm tra yêu cầu hủy
                if (this.shouldCancel) {
                    logger.warn('[ScheduledShutdown] ⚠️ ĐÃ HỦY QUY TRÌNH POWERON');
                    // Xóa labels ngay khi hủy
                    await db.execute('DELETE FROM scheduled_shutdown_labels');
                    logger.info('[ScheduledShutdown] ✓ Đã xóa tất cả labels (sau hủy)');
                    return; // Thoát khỏi execute()
                }
                
                // Lấy batch trạm đang chờ bật (waiting_poweron)
                const batchLimit = parseInt(config.batch_size) || 5;
                const [batch] = await db.query(
                    `SELECT sl.station_id, s.ewelink_device_id as device_id 
                     FROM scheduled_shutdown_labels sl 
                     JOIN stations s ON sl.station_id = s.id 
                     WHERE sl.status IN ('waiting_poweron', 'powering_on') 
                     LIMIT ${batchLimit}`
                );
                
                if (batch.length === 0) break;
                
                logger.info(`[ScheduledShutdown] Bật lại batch: ${batch.length} trạm...`);
                const results = await this.poweronBatch(batch);
                
                // Delay giữa các batch
                if (batch.length === config.batch_size) {
                    logger.info(`[ScheduledShutdown] Chờ ${config.batch_delay_seconds}s trước batch tiếp...`);
                    await sleep(config.batch_delay_seconds * 1000);
                }
            }
            
            // Kiểm tra kết quả cuối cùng
            const [summary] = await db.execute(
                "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed FROM scheduled_shutdown_labels"
            );
            
            const stats = summary[0];
            
            // Cập nhật lịch sử
            await db.execute(
                `UPDATE scheduled_shutdown_history 
                SET successful_stations = ?, 
                    failed_stations = ?, 
                    status = "completed", 
                    completed_at = NOW() 
                WHERE id = ?`,
                [stats.completed, stats.failed, this.currentExecutionId]
            );
            
            // Xóa tất cả labels sau khi hoàn thành để không ảnh hưởng đến recovery mechanism
            await db.execute('DELETE FROM scheduled_shutdown_labels');
            logger.info('[ScheduledShutdown] ✓ Đã xóa tất cả labels');
            
            logger.info('[ScheduledShutdown] ========== KẾT THÚC QUY TRÌNH ==========');
            logger.info(`[ScheduledShutdown] Tổng: ${stats.total} | Thành công: ${stats.completed} | Thất bại: ${stats.failed}`);
            
        } catch (error) {
            logger.error('[ScheduledShutdown] LỖI QUY TRÌNH: ' + error.message);
            logger.error(error.stack);
            
            if (this.currentExecutionId) {
                await db.execute(
                    'UPDATE scheduled_shutdown_history SET status = "failed", notes = ?, completed_at = NOW() WHERE id = ?',
                    [error.message, this.currentExecutionId]
                );
            }
            
            // Xóa labels ngay cả khi có lỗi
            await db.execute('DELETE FROM scheduled_shutdown_labels');
            logger.info('[ScheduledShutdown] ✓ Đã xóa tất cả labels (sau lỗi)');
            
        } finally {
            this.isRunning = false;
            this.currentExecutionId = null;
            this.shouldCancel = false;
        }
    }

    /**
     * Lấy trạng thái hiện tại
     */
    async getStatus() {
        try {
            const config = await this.getConfig();
            
            // Đếm nhãn hiện tại
            const [labelStats] = await db.execute(
                'SELECT status, COUNT(*) as count FROM scheduled_shutdown_labels GROUP BY status'
            );
            
            // Lịch sử gần nhất
            const [history] = await db.execute(
                'SELECT * FROM scheduled_shutdown_history ORDER BY execution_date DESC, started_at DESC LIMIT 10'
            );
            
            return {
                config,
                is_running: this.isRunning,
                current_execution_id: this.currentExecutionId,
                label_statistics: labelStats,
                recent_history: history
            };
        } catch (error) {
            logger.error('[ScheduledShutdown] Lỗi lấy status: ' + error.message);
            throw error;
        }
    }

    /**
     * Hủy quy trình đang chạy
     */
    async cancel() {
        if (!this.isRunning) {
            logger.warn('[ScheduledShutdown] Không có quy trình nào đang chạy');
            return false;
        }
        
        logger.warn('[ScheduledShutdown] ⚠️ YÊU CẦU HỦY QUY TRÌNH');
        this.shouldCancel = true;
        
        // Cập nhật lịch sử
        if (this.currentExecutionId) {
            await db.execute(
                'UPDATE scheduled_shutdown_history SET status = "cancelled", notes = "Đã hủy bởi người dùng", completed_at = NOW() WHERE id = ?',
                [this.currentExecutionId]
            );
        }
        
        return true;
    }

    /**
     * Lấy danh sách trạm theo status
     */
    async getStationsByStatus(status) {
        try {
            let query = `
                SELECT sl.*, s.stationName, s.identificationName
                FROM scheduled_shutdown_labels sl
                JOIN stations s ON sl.station_id = s.id
            `;
            
            if (status) {
                query += ` WHERE sl.status = '${status}'`;
            }
            
            query += ' ORDER BY sl.labeled_at DESC';
            
            const [stations] = await db.query(query);
            return stations;
        } catch (error) {
            logger.error('[ScheduledShutdown] Lỗi lấy danh sách trạm: ' + error.message);
            throw error;
        }
    }

    /**
     * Lấy lịch sử với phân trang
     */
    async getHistory(page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;
            
            // Đếm tổng số
            const [countResult] = await db.query(
                'SELECT COUNT(*) as total FROM scheduled_shutdown_history'
            );
            const total = countResult[0].total;
            
            // Lấy dữ liệu theo trang
            const [history] = await db.query(
                `SELECT * FROM scheduled_shutdown_history 
                 ORDER BY execution_date DESC, started_at DESC 
                 LIMIT ${limit} OFFSET ${offset}`
            );
            
            return {
                data: history,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('[ScheduledShutdown] Lỗi lấy lịch sử: ' + error.message);
            throw error;
        }
    }
}

// Export singleton instance
const scheduledShutdownService = new ScheduledShutdownService();
module.exports = scheduledShutdownService;
