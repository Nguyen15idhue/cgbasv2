const crypto = require('crypto');

/**
 * Tạo chữ ký Signature theo tài liệu CGBAS PRO
 */
function generateCGBASSignature(method, path, headers, secretKey) {
    // 1. Lấy các header bắt đầu bằng X-, sắp xếp ASCII, chuyển key sang lowercase
    const sortedHeaderKeys = Object.keys(headers)
        .filter(key => key.toLowerCase().startsWith('x-'))
        .sort();

    const headerStr = sortedHeaderKeys
        .map(key => `${key.toLowerCase()}=${headers[key]}`)
        .join('&');

    // 2. Chuỗi nội dung: Method + Path + HeaderStr (ngăn cách bằng khoảng trắng)
    const content = `${method.toUpperCase()} ${path} ${headerStr}`;

    // 3. HMAC-SHA256 và chuyển sang Hex
    return crypto
        .createHmac('sha256', secretKey)
        .update(content)
        .digest('hex');
}

module.exports = { generateCGBASSignature };