// src/services/stationControlService.js
const { toggleChannel } = require('./ewelinkService');
const { sleep, retryAction } = require('../utils/helper');
const db = require('../config/database');

async function updateDbStatus(deviceid, outlet, status) {
    const field = outlet === 0 ? 'switch_0' : 'switch_1';
    await db.execute(`UPDATE ewelink_status SET ${field} = ? WHERE deviceid = ?`, [status, deviceid]);
}

/**
 * KỊCH BẢN BẬT TRẠM
 */
async function turnOnStation(deviceid) {
    console.log(`\n=== BẮT ĐẦU KỊCH BẢN BẬT TRẠM: ${deviceid} ===`);

    // Bước 1: Bật kênh 1 (Nguồn chính)
    const step1 = await retryAction(() => toggleChannel(deviceid, 0, 'on'), `Bật Kênh 1 (Nguồn)`);
    if (!step1) return { success: false, step: 1, msg: "Không thể bật Kênh 1 sau 5 lần thử" };
    await updateDbStatus(deviceid, 0, 'on');

    // Bước 2: Chờ 10 giây
    console.log(`[WAIT] Chờ 10 giây cho thiết bị khởi động...`);
    await sleep(10000);

    // Bước 3: Bật kênh 2 (Kích khởi động)
    const step3 = await retryAction(() => toggleChannel(deviceid, 1, 'on'), `Bật Kênh 2 (Kích)`);
    if (!step3) return { success: false, step: 3, msg: "Không thể bật Kênh 2 sau 5 lần thử" };
    await updateDbStatus(deviceid, 1, 'on');

    // Bước 4: Chờ 5 giây
    console.log(`[WAIT] Chờ 5 giây...`);
    await sleep(5000);

    // Bước 5: Tắt kênh 2 (Nhả nút kích)
    const step5 = await retryAction(() => toggleChannel(deviceid, 1, 'off'), `Tắt Kênh 2 (Nhả kích)`);
    if (!step5) return { success: false, step: 5, msg: "Không thể tắt Kênh 2 sau 5 lần thử" };
    await updateDbStatus(deviceid, 1, 'off');

    console.log(`=== HOÀN THÀNH BẬT TRẠM THÀNH CÔNG ===\n`);
    return { success: true, msg: "Bật trạm thành công theo kịch bản" };
}

/**
 * KỊCH BẢN TẮT TRẠM
 */
async function turnOffStation(deviceid) {
    console.log(`\n=== BẮT ĐẦU KỊCH BẢN TẮT TRẠM: ${deviceid} ===`);

    // Bước 1: Bật kênh 2 (Kích lệnh tắt)
    const step1 = await retryAction(() => toggleChannel(deviceid, 1, 'on'), `Bật Kênh 2 (Kích tắt)`);
    if (!step1) return { success: false, step: 1, msg: "Không thể bật Kênh 2 sau 5 lần thử" };
    await updateDbStatus(deviceid, 1, 'on');

    // Bước 2: Chờ 5 giây
    console.log(`[WAIT] Chờ 5 giây...`);
    await sleep(5000);

    // Bước 3: Tắt kênh 2 (Nhả nút kích)
    const step3 = await retryAction(() => toggleChannel(deviceid, 1, 'off'), `Tắt Kênh 2 (Nhả kích)`);
    if (!step3) return { success: false, step: 3, msg: "Không thể tắt Kênh 2 sau 5 lần thử" };
    await updateDbStatus(deviceid, 1, 'off');

    // Bước 4: Chờ 10 giây
    console.log(`[WAIT] Chờ 10 giây cho hệ thống đóng hoàn toàn...`);
    await sleep(10000);

    // Bước 5: Tắt kênh 1 (Ngắt nguồn sạch)
    const step5 = await retryAction(() => toggleChannel(deviceid, 0, 'off'), `Tắt Kênh 1 (Ngắt nguồn)`);
    if (!step5) return { success: false, step: 5, msg: "Không thể tắt Kênh 1 sau 5 lần thử" };
    await updateDbStatus(deviceid, 0, 'off');

    console.log(`=== HOÀN THÀNH TẮT TRẠM THÀNH CÔNG ===\n`);
    return { success: true, msg: "Tắt trạm thành công theo kịch bản" };
}

module.exports = { turnOnStation, turnOffStation };