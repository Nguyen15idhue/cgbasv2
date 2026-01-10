const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
    console.log('--- Đang kiểm tra Database và chạy Migration ---');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        multipleStatements: true
    });

    try {
        const dbName = process.env.DB_NAME || 'cgbas_db';

        // 1. Tạo Database
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        console.log(`- Database "${dbName}": Đã sẵn sàng.`);
        await connection.query(`USE \`${dbName}\`;`);

        // 2. Tự động đọc tất cả file .sql trong thư mục này
        const migrationDir = __dirname;
        const files = fs.readdirSync(migrationDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Sắp xếp theo tên để chạy 001 trước 002

        for (const file of files) {
            const sqlPath = path.join(migrationDir, file);
            const sql = fs.readFileSync(sqlPath, 'utf8');
            await connection.query(sql);
            console.log(`- Thực thi migration: ${file} (Thành công)`);
        }

        console.log('Migration hoàn tất.');
    } catch (error) {
        console.error('Lỗi trong quá trình migration:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

module.exports = runMigrations;