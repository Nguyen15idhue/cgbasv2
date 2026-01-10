const db = require('../config/database');

async function upsertEwelinkDevice(itemData) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Lưu thông tin thiết bị
        const sqlDevice = `
            INSERT INTO ewelink_devices (deviceid, name, model, online, familyid, apikey)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE name=VALUES(name), online=VALUES(online);
        `;
        await conn.execute(sqlDevice, [
            itemData.deviceid, itemData.name, itemData.productModel, 
            itemData.online, itemData.family.familyid, itemData.apikey
        ]);

        // 2. Lưu trạng thái (lấy từ params.switches)
        const switches = itemData.params.switches || [];
        const sw0 = switches.find(s => s.outlet === 0)?.switch || 'unknown';
        const sw1 = switches.find(s => s.outlet === 1)?.switch || 'unknown';

        const sqlStatus = `
            INSERT INTO ewelink_status (deviceid, switch_0, switch_1, voltage_0, current_0, actPow_0)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE switch_0=VALUES(switch_0), switch_1=VALUES(switch_1), 
            voltage_0=VALUES(voltage_0), current_0=VALUES(current_0), actPow_0=VALUES(actPow_0);
        `;
        await conn.execute(sqlStatus, [
            itemData.deviceid, sw0, sw1, 
            itemData.params.voltage_00 || 0, 
            itemData.params.current_00 || 0, 
            itemData.params.actPow_00 || 0
        ]);

        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

async function getDeviceDetails(deviceid) {
    const [rows] = await db.query(`
        SELECT d.*, s.switch_0, s.switch_1, s.voltage_0 
        FROM ewelink_devices d 
        JOIN ewelink_status s ON d.deviceid = s.deviceid 
        WHERE d.deviceid = ?
    `, [deviceid]);
    return rows[0];
}

module.exports = { upsertEwelinkDevice, getDeviceDetails };