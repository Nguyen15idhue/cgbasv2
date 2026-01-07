const mysql = require('mysql2/promise'); // Dùng thư viện gốc để tạo kết nối ban đầu
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
    console.log('--- Đang kiểm tra Database và chạy Migration ---');

    // 1. Kết nối đến MySQL Server (không chỉ định Database name ở đây)
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        multipleStatements: true
    });

    try {
        const dbName = process.env.DB_NAME || 'cgbas_db';

        // 2. Tự động tạo Database nếu chưa có
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        console.log(`- Database "${dbName}": Đã sẵn sàng.`);

        // 3. Chuyển sang sử dụng database này
        await connection.query(`USE \`${dbName}\`;`);

        // 4. Đọc file SQL tạo bảng
        const sqlPath = path.join(__dirname, '001_create_stations_table.sql');
        if (fs.existsSync(sqlPath)) {
            const sql = fs.readFileSync(sqlPath, 'utf8');
            await connection.query(sql);
            console.log('- Các bảng dữ liệu: Đã kiểm tra/tạo thành công.');
        } else {
            console.warn('- Cảnh báo: Không tìm thấy file 001_create_stations_table.sql');
        }

        console.log('Migration hoàn tất.');
    } catch (error) {
        console.error('Lỗi trong quá trình migration:', error.message);
        throw error; // Ném lỗi để main.js dừng lại
    } finally {
        // Đóng kết nối tạm thời này lại
        await connection.end();
    }
}

module.exports = runMigrations;