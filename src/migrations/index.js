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

        // 2. Tạo bảng tracking migrations
        await connection.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                filename VARCHAR(255) PRIMARY KEY,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Tự động đọc tất cả file .sql trong thư mục này
        const migrationDir = __dirname;
        const files = fs.readdirSync(migrationDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Sắp xếp theo tên để chạy 001 trước 002

        for (const file of files) {
            // Kiểm tra xem migration đã chạy chưa
            const [existing] = await connection.query(
                'SELECT filename FROM migrations WHERE filename = ?',
                [file]
            );

            if (existing.length > 0) {
                console.log(`- Migration ${file}: Đã chạy trước đó (Bỏ qua)`);
                continue;
            }

            const sqlPath = path.join(migrationDir, file);
            const sql = fs.readFileSync(sqlPath, 'utf8');
            
            try {
                await connection.query(sql);
                await connection.query(
                    'INSERT INTO migrations (filename) VALUES (?)',
                    [file]
                );
                console.log(`- Thực thi migration: ${file} (Thành công)`);
            } catch (err) {
                // Bỏ qua lỗi duplicate column
                if (err.code === 'ER_DUP_FIELDNAME') {
                    await connection.query(
                        'INSERT IGNORE INTO migrations (filename) VALUES (?)',
                        [file]
                    );
                    console.log(`- Migration ${file}: Cột đã tồn tại (Bỏ qua)`);
                } else {
                    throw err;
                }
            }
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