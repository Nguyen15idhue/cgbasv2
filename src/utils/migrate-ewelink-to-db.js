/**
 * Script một lần để migrate cấu hình eWeLink từ .env vào database
 * Chạy: node src/utils/migrate-ewelink-to-db.js
 */

require('dotenv').config();
const db = require('../config/database');
const logger = require('./logger');

async function migrateEwelinkConfig() {
    try {
        console.log('=== Bắt đầu migrate cấu hình eWeLink từ .env vào DB ===\n');

        // Lấy cấu hình từ .env
        const config = {
            app_id: process.env.EWELINK_APPID,
            app_secret: process.env.EWELINK_APPSECRET,
            api_url: process.env.EWELINK_API || 'https://as-apia.coolkit.cc',
            access_token: process.env.EWELINK_TOKEN || null,
            refresh_token: process.env.EWELINK_REFRESHTOKEN || null
        };

        console.log('Config từ .env:');
        console.log('- APPID:', config.app_id ? '✓ Có' : '✗ Thiếu');
        console.log('- APPSECRET:', config.app_secret ? '✓ Có' : '✗ Thiếu');
        console.log('- API URL:', config.api_url);
        console.log('- ACCESS_TOKEN:', config.access_token ? '✓ Có' : '✗ Thiếu');
        console.log('- REFRESH_TOKEN:', config.refresh_token ? '✓ Có' : '✗ Thiếu');
        console.log('');

        if (!config.app_id || !config.app_secret) {
            throw new Error('Thiếu EWELINK_APPID hoặc EWELINK_APPSECRET trong .env');
        }

        // Kiểm tra xem đã có config trong DB chưa
        const [rows] = await db.execute('SELECT * FROM ewelink_config LIMIT 1');

        if (rows.length > 0) {
            console.log('⚠️  Database đã có cấu hình eWeLink!');
            console.log('Bạn có muốn cập nhật (UPDATE) không? (y/n)');
            
            // Trong script tự động, ta sẽ UPDATE
            const sql = `
                UPDATE ewelink_config 
                SET app_id = ?,
                    app_secret = ?,
                    api_url = ?,
                    access_token = ?,
                    refresh_token = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;

            await db.execute(sql, [
                config.app_id,
                config.app_secret,
                config.api_url,
                config.access_token,
                config.refresh_token,
                rows[0].id
            ]);

            console.log('✓ Đã cập nhật cấu hình eWeLink trong database!');
        } else {
            // INSERT mới
            const sql = `
                INSERT INTO ewelink_config (app_id, app_secret, api_url, access_token, refresh_token)
                VALUES (?, ?, ?, ?, ?)
            `;

            await db.execute(sql, [
                config.app_id,
                config.app_secret,
                config.api_url,
                config.access_token,
                config.refresh_token
            ]);

            console.log('✓ Đã tạo cấu hình eWeLink trong database!');
        }

        // Verify
        const [newRows] = await db.execute('SELECT * FROM ewelink_config LIMIT 1');
        console.log('\nCấu hình trong DB:');
        console.log(newRows[0]);

        console.log('\n=== Hoàn tất migrate cấu hình eWeLink ===');
        console.log('Bây giờ hệ thống sẽ đọc cấu hình từ database thay vì .env');

        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi khi migrate:', error.message);
        logger.error('[Migrate] Error: ' + error.message);
        process.exit(1);
    }
}

// Run migration
migrateEwelinkConfig();
