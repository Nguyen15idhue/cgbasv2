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

module.exports = { upsertStations, getAllStations, upsertDynamicInfo, getAllStationIds };