const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * VERIFY TRAM ONLINE LAI SAU PHA BAT (Phase 2).
 *
 * Chay roi qua cron (khong setTimeout trong execute): quet details
 * poweron_ok=1 nhung chua verify va da qua verify_delay_minutes,
 * doc connectStatus hien tai roi chot verified_online.
 * Song qua restart vi khong giu state trong RAM.
 */
async function runOnce() {
    let cfg = null;
    try {
        const [cfgRows] = await db.execute(
            'SELECT verify_enabled, verify_delay_minutes, batch_size FROM scheduled_shutdown_config WHERE id = 1'
        );
        cfg = cfgRows[0] || null;
    } catch (error) {
        logger.error('[Verify] Loi doc config: ' + error.message);
        return { checked: 0, error: error.message };
    }

    if (!cfg || !cfg.verify_enabled) {
        return { checked: 0, skipped: true };
    }

    const delay = Math.min(Math.max(parseInt(cfg.verify_delay_minutes, 10) || 10, 1), 120);
    const batchLimit = Math.min(Math.max(parseInt(cfg.batch_size, 10) || 5, 1), 50);

    let rows = [];
    try {
        [rows] = await db.query(
            `SELECT d.history_id, d.station_id
             FROM scheduled_shutdown_details d
             JOIN scheduled_shutdown_history h ON d.history_id = h.id
             WHERE d.verified_online IS NULL
               AND d.poweron_ok = 1
               AND d.poweron_at < NOW() - INTERVAL ${delay} MINUTE
               AND h.status = 'completed'
             LIMIT ${batchLimit}`
        );
    } catch (error) {
        logger.error('[Verify] Loi tim details toi han: ' + error.message);
        return { checked: 0, error: error.message };
    }

    let online = 0;
    let offline = 0;

    for (const r of rows) {
        try {
            const [dyn] = await db.execute(
                'SELECT connectStatus FROM station_dynamic_info WHERE stationId = ?',
                [r.station_id]
            );
            const status = dyn.length > 0 ? dyn[0].connectStatus : null;
            const isOnline = status === 1 ? 1 : 0;

            await db.execute(
                `UPDATE scheduled_shutdown_details
                 SET verified_online = ?, verified_at = NOW(), verified_status = ?
                 WHERE history_id = ? AND station_id = ?`,
                [isOnline, status, r.history_id, r.station_id]
            );

            if (isOnline) {
                online++;
            } else {
                offline++;
                const [jobs] = await db.execute(
                    'SELECT id FROM station_recovery_jobs WHERE station_id = ?',
                    [r.station_id]
                );
                if (jobs.length === 0) {
                    logger.warn(`[Verify] Tram ${r.station_id} van offline sau bat (status=${status}). Monitor se tu tao job.`);
                }
            }
        } catch (error) {
            logger.error(`[Verify] Loi verify tram ${r.station_id}: ` + error.message);
        }
    }

    if (rows.length > 0) {
        logger.info(`[Verify] Da verify ${rows.length} tram: ${online} online, ${offline} offline.`);
    }

    return { checked: rows.length, online, offline };
}

module.exports = { runOnce };
