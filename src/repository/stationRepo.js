const db = require('../config/database');

async function upsertStations(stations) {
    const sql = `
        INSERT INTO stations 
        (id, stationName, identificationName, stationType, receiverType, antennaType, antennaHigh, lat, lng, status, createTime, updateTime)
        VALUES ?
        ON DUPLICATE KEY UPDATE 
        stationName=VALUES(stationName), 
        identificationName=VALUES(identificationName),
        status=VALUES(status), 
        updateTime=VALUES(updateTime);
    `;

    // Chuyển mảng object thành mảng các giá trị để dùng bulk insert
    const values = stations.map(s => [
        s.id, s.stationName, s.identificationName, s.stationType, 
        s.receiverType, s.antennaType, s.antennaHigh, 
        s.lat, s.lng, s.status, s.createTime, s.updateTime
    ]);

    return db.query(sql, [values]);
}

// Lấy danh sách trạm từ DB của chính mình
async function getAllStations() {
    const [rows] = await db.query('SELECT * FROM stations ORDER BY stationName ASC');
    return rows;
}

// Lấy danh sách trạm theo status_source
async function getStationsBySource(source) {
    const [rows] = await db.query('SELECT * FROM stations WHERE status_source = ? ORDER BY stationName ASC', [source]);
    return rows;
}

// Lấy danh sách trạm CGBAS (status_source = 'cgbas' hoặc NULL)
async function getCgbasStations() {
    const [rows] = await db.query('SELECT * FROM stations WHERE status_source = "cgbas" OR status_source IS NULL ORDER BY stationName ASC');
    return rows;
}

// Lấy danh sách trạm NTRIP (status_source = 'ntrip')
async function getNtripStations() {
    const [rows] = await db.query('SELECT * FROM stations WHERE status_source = "ntrip" ORDER BY stationName ASC');
    return rows;
}

async function upsertDynamicInfo(data) {
    const sql = `
        INSERT INTO station_dynamic_info 
        (stationId, connectStatus, epochTime, delay, sat_R, sat_C, sat_E, sat_G)
        VALUES ?
        ON DUPLICATE KEY UPDATE 
        connectStatus=VALUES(connectStatus),
        epochTime=VALUES(epochTime),
        delay=VALUES(delay),
        sat_R=VALUES(sat_R),
        sat_C=VALUES(sat_C),
        sat_E=VALUES(sat_E),
        sat_G=VALUES(sat_G);
    `;

    const values = data.map(item => [
        item.stationId,
        item.connectStatus,
        item.epochTime,
        item.delay,
        item.satesMap?.R || 0,
        item.satesMap?.C || 0,
        item.satesMap?.E || 0,
        item.satesMap?.G || 0
    ]);

    if (values.length === 0) return;
    return db.query(sql, [values]);
}

// Hàm lấy tất cả ID trạm hiện có trong DB
async function getAllStationIds() {
    const [rows] = await db.query('SELECT id FROM stations');
    return rows.map(r => r.id);
}

// Hàm lấy ID trạm CGBAS (skip NTRIP)
async function getCgbasStationIds() {
    const [rows] = await db.query('SELECT id FROM stations WHERE status_source = "cgbas" OR status_source IS NULL');
    return rows.map(r => r.id);
}

// Hàm lấy ID trạm NTRIP
async function getNtripStationIds() {
    const [rows] = await db.query('SELECT id FROM stations WHERE status_source = "ntrip"');
    return rows.map(r => r.id);
}

// Lấy thông tin NTRIP config của trạm
async function getNtripConfig(stationId) {
    const [rows] = await db.query('SELECT * FROM ntrip_config WHERE station_id = ?', [stationId]);
    return rows[0] || null;
}

// Cập nhật NTRIP config
async function upsertNtripConfig(stationId, config) {
    const sql = `
        INSERT INTO ntrip_config (station_id, ntrip_url, mountpoint, ntrip_user, ntrip_pass, interval_seconds, is_active, gga_frequency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        ntrip_url=VALUES(ntrip_url),
        mountpoint=VALUES(mountpoint),
        ntrip_user=VALUES(ntrip_user),
        ntrip_pass=VALUES(ntrip_pass),
        interval_seconds=VALUES(interval_seconds),
        is_active=VALUES(is_active),
        gga_frequency=VALUES(gga_frequency)
    `;
    return db.query(sql, [
        stationId,
        config.ntrip_url,
        config.mountpoint,
        config.ntrip_user || null,
        config.ntrip_pass || null,
        config.interval_seconds || 5,
        config.is_active !== undefined ? config.is_active : 1,
        config.gga_frequency || '1hz'
    ]);
}

// Xóa NTRIP config
async function deleteNtripConfig(stationId) {
    return db.query('DELETE FROM ntrip_config WHERE station_id = ?', [stationId]);
}

// Cập nhật status_source của trạm
async function updateStatusSource(stationId, source) {
    return db.query('UPDATE stations SET status_source = ? WHERE id = ?', [source, stationId]);
}

module.exports = { 
    upsertStations, 
    getAllStations, 
    getStationsBySource,
    getCgbasStations,
    getNtripStations,
    upsertDynamicInfo, 
    getAllStationIds,
    getCgbasStationIds,
    getNtripStationIds,
    getNtripConfig,
    upsertNtripConfig,
    deleteNtripConfig,
    updateStatusSource
};