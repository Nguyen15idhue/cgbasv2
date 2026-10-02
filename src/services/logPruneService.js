const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * DON LOG CU: prune ewelink_api_logs + ntrip_logs theo dot nho.
 * Chay hang ngay luc thap diem; moi dot LIMIT 5000 de tranh lock/write stall.
 */
const BATCH = 1000; // nho de khong giu lock lau tren disk yeu (5000 x 65KB ~ 325MB/batch)
const MAX_BATCHES = 30; // toi da ~30k dong/lan chay, cron hang ngay se grind dan

async function pruneTable(table, dateColumn, days) {
    let total = 0;
    for (let i = 0; i < MAX_BATCHES; i++) {
        const [res] = await db.execute(
            `DELETE FROM ${table} WHERE ${dateColumn} < NOW() - INTERVAL ? DAY LIMIT ${BATCH}`,
            [days]
        );
        const n = res.affectedRows || 0;
        total += n;
        if (n < BATCH) break;
        await new Promise((r) => setTimeout(r, 2000)); // nghi 2s giua cac dot
    }
    return total;
}

async function runOnce(days) {
    const retention = Math.min(Math.max(parseInt(days ?? process.env.LOG_RETENTION_DAYS ?? '30', 10) || 30, 1), 365);
    const out = { retention_days: retention, ewelink_api_logs: 0, ntrip_logs: 0 };
    try {
        out.ewelink_api_logs = await pruneTable('ewelink_api_logs', 'created_at', retention);
    } catch (error) {
        logger.error('[LogPrune] Loi don ewelink_api_logs: ' + error.message);
    }
    try {
        out.ntrip_logs = await pruneTable('ntrip_logs', 'created_at', retention);
    } catch (error) {
        logger.error('[LogPrune] Loi don ntrip_logs: ' + error.message);
    }
    if (out.ewelink_api_logs > 0 || out.ntrip_logs > 0) {
        logger.info(`[LogPrune] Da don (giu ${retention} ngay): ewelink_api_logs=${out.ewelink_api_logs}, ntrip_logs=${out.ntrip_logs}.`);
    }
    return out;
}

module.exports = { runOnce };
