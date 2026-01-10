// src/utils/helper.js
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Hàm thực hiện thử lại một hành động khi thất bại
 * @param {Function} actionFn - Hàm async cần thực hiện
 * @param {string} label - Nhãn để log
 * @param {number} maxRetries - Số lần thử lại tối đa
 */
async function retryAction(actionFn, label, maxRetries = 5) {
    for (let i = 1; i <= maxRetries; i++) {
        try {
            const result = await actionFn();
            if (result && result.error === 0) {
                console.log(`[SUCCESS] ${label} thành công ở lần thử thứ ${i}`);
                return true;
            }
            throw new Error(result.msg || "Lỗi phản hồi từ thiết bị");
        } catch (error) {
            console.error(`[RETRY ${i}/${maxRetries}] ${label} thất bại: ${error.message}`);
            if (i === maxRetries) return false;
            await sleep(2000); // Đợi 2 giây trước khi thử lại lần tiếp theo
        }
    }
}

module.exports = { sleep, retryAction };