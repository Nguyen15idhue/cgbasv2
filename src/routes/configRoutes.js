const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const logger = require('../utils/logger');
const { sendTelegramMessage } = require('../utils/telegramNotify');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

/**
 * GET /api/configs/ewelink
 * Lấy toàn bộ cấu hình eWeLink từ database
 */
router.get('/ewelink', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM ewelink_config LIMIT 1');
        
        if (rows.length === 0) {
            // Fallback to .env nếu chưa có trong DB
            return res.json({
                success: true,
                data: {
                    appId: process.env.EWELINK_APPID || '',
                    appSecret: process.env.EWELINK_APPSECRET || '',
                    apiUrl: process.env.EWELINK_API || 'https://as-apia.coolkit.cc',
                    accessToken: process.env.EWELINK_TOKEN || '',
                    refreshToken: process.env.EWELINK_REFRESHTOKEN || '',
                    tokenExpiry: null,
                    refreshTokenExpiry: null
                }
            });
        }
        
        const config = rows[0];
        
        res.json({
            success: true,
            data: {
                appId: config.app_id,
                appSecret: config.app_secret,
                apiUrl: config.api_url,
                accessToken: config.access_token || '',
                refreshToken: config.refresh_token || '',
                tokenExpiry: config.token_expiry,
                refreshTokenExpiry: config.refresh_token_expiry
            }
        });
        
    } catch (error) {
        logger.error('[Config] Error getting ewelink config: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải cấu hình eWeLink'
        });
    }
});

/**
 * POST /api/configs/ewelink
 * Cập nhật toàn bộ cấu hình eWeLink
 */
router.post('/ewelink', async (req, res) => {
    try {
        const { appId, appSecret, apiUrl, accessToken, refreshToken, tokenExpiry, refreshTokenExpiry } = req.body;
        
        // Validate
        if (!appId || !appSecret || !apiUrl) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ App ID, App Secret và API URL'
            });
        }
        
        // Kiểm tra xem đã có config chưa
        const [rows] = await db.execute('SELECT * FROM ewelink_config LIMIT 1');
        
        if (rows.length > 0) {
            // UPDATE
            const sql = `
                UPDATE ewelink_config 
                SET app_id = ?,
                    app_secret = ?,
                    api_url = ?,
                    access_token = ?,
                    refresh_token = ?,
                    token_expiry = ?,
                    refresh_token_expiry = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;
            
            await db.execute(sql, [
                appId,
                appSecret,
                apiUrl,
                accessToken || null,
                refreshToken || null,
                tokenExpiry || null,
                refreshTokenExpiry || null,
                rows[0].id
            ]);
        } else {
            // INSERT
            const sql = `
                INSERT INTO ewelink_config 
                (app_id, app_secret, api_url, access_token, refresh_token, token_expiry, refresh_token_expiry)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            await db.execute(sql, [
                appId,
                appSecret,
                apiUrl,
                accessToken || null,
                refreshToken || null,
                tokenExpiry || null,
                refreshTokenExpiry || null
            ]);
        }
        
        // Cập nhật ewelinkService runtime
        const ewelinkService = require('../services/ewelinkService');
        if (ewelinkService.updateConfig) {
            ewelinkService.updateConfig({
                appId,
                appSecret,
                apiUrl,
                accessToken,
                refreshToken
            });
        }
        
        logger.info(`[Config] Cấu hình eWeLink đã được cập nhật bởi user ${req.session.user?.username}`);
        
        res.json({
            success: true,
            message: 'Cập nhật cấu hình eWeLink thành công'
        });
        
    } catch (error) {
        logger.error('[Config] Error updating ewelink config: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật cấu hình: ' + error.message
        });
    }
});

/**
 * GET /api/configs/token-info (DEPRECATED - Use /api/configs/ewelink)
 * Lấy thông tin token hiện tại
 */
router.get('/token-info', async (req, res) => {
    try {
        // Đọc từ ewelink_config mới
        const [rows] = await db.execute('SELECT * FROM ewelink_config LIMIT 1');
        
        if (rows.length === 0) {
            // Nếu chưa có trong DB, lấy từ environment variables
            return res.json({
                success: true,
                data: {
                    accessToken: process.env.EWELINK_TOKEN || '',
                    refreshToken: process.env.EWELINK_REFRESHTOKEN || '',
                    tokenExpiry: null,
                    refreshTokenExpiry: null
                }
            });
        }
        
        const config = rows[0];
        
        res.json({
            success: true,
            data: {
                accessToken: config.access_token || '',
                refreshToken: config.refresh_token || '',
                tokenExpiry: config.token_expiry,
                refreshTokenExpiry: config.refresh_token_expiry
            }
        });
        
    } catch (error) {
        logger.error('[Config] Error getting token info: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải thông tin token'
        });
    }
});

/**
 * POST /api/configs/update-token (DEPRECATED - Use /api/configs/ewelink)
 * Cập nhật eWeLink token mới
 */
router.post('/update-token', async (req, res) => {
    try {
        const { accessToken, refreshToken, tokenExpiry, refreshTokenExpiry } = req.body;
        
        if (!accessToken || !refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin token'
            });
        }
        
        // Lấy config hiện tại
        const [rows] = await db.execute('SELECT * FROM ewelink_config LIMIT 1');
        
        if (rows.length > 0) {
            // UPDATE token trong ewelink_config
            const sql = `
                UPDATE ewelink_config 
                SET access_token = ?,
                    refresh_token = ?,
                    token_expiry = ?,
                    refresh_token_expiry = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;
            
            await db.execute(sql, [
                accessToken,
                refreshToken,
                tokenExpiry || null,
                refreshTokenExpiry || null,
                rows[0].id
            ]);
        } else {
            // Nếu chưa có config, tạo mới với giá trị từ .env
            const sql = `
                INSERT INTO ewelink_config 
                (app_id, app_secret, api_url, access_token, refresh_token, token_expiry, refresh_token_expiry)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            await db.execute(sql, [
                process.env.EWELINK_APPID || '',
                process.env.EWELINK_APPSECRET || '',
                process.env.EWELINK_API || 'https://as-apia.coolkit.cc',
                accessToken,
                refreshToken,
                tokenExpiry || null,
                refreshTokenExpiry || null
            ]);
        }
        
        // Update ewelinkService token
        const ewelinkService = require('../services/ewelinkService');
        if (ewelinkService.updateTokens) {
            ewelinkService.updateTokens(accessToken, refreshToken);
        }
        
        logger.info(`[Config] Token đã được cập nhật bởi user ${req.session.user?.username}`);
        
        res.json({
            success: true,
            message: 'Cập nhật token thành công'
        });
        
    } catch (error) {
        logger.error('[Config] Error updating token: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật token: ' + error.message
        });
    }
});

/**
 * POST /api/configs/test-token
 * Test token mới có hoạt động không
 */
router.post('/test-token', async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập access token'
            });
        }
        
        // Lấy config từ DB để test
        const [rows] = await db.execute('SELECT * FROM ewelink_config LIMIT 1');
        
        let appId, apiUrl;
        if (rows.length > 0) {
            appId = rows[0].app_id;
            apiUrl = rows[0].api_url;
        } else {
            // Fallback to .env
            appId = process.env.EWELINK_APPID;
            apiUrl = process.env.EWELINK_API || 'https://as-apia.coolkit.cc';
        }
        
        if (!appId) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu cấu hình EWELINK_APPID'
            });
        }
        
        // Test token bằng cách gọi API eWeLink
        const axios = require('axios');
        const response = await axios.get(
            `${apiUrl}/v2/device/thing`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-CK-Appid': appId
                },
                params: {
                    num: 1
                }
            }
        );
        
        if (response.data.error === 0) {
            res.json({
                success: true,
                message: `Token hợp lệ! Tìm thấy ${response.data.data?.thingList?.length || 0} thiết bị.`
            });
        } else {
            res.json({
                success: false,
                message: 'Token không hợp lệ hoặc đã hết hạn'
            });
        }
        
    } catch (error) {
        logger.error('[Config] Error testing token: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Token không hợp lệ: ' + error.message
        });
    }
});

/**
 * POST /api/configs/change-password
 * Đổi mật khẩu người dùng
 */
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin'
            });
        }
        
        const userId = req.session.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập'
            });
        }
        
        // 1. Lấy thông tin user hiện tại
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }
        
        const user = rows[0];
        
        // 2. Kiểm tra mật khẩu hiện tại
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Mật khẩu hiện tại không đúng'
            });
        }
        
        // 3. Hash mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // 4. Cập nhật mật khẩu
        await db.execute(
            'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
            [hashedPassword, userId]
        );
        
        logger.info(`[Config] User ${user.username} đã đổi mật khẩu thành công`);

        await sendTelegramMessage(`🔐 <b>Đổi mật khẩu</b>\n👤 Người dùng: ${user.username}\n⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n✅ Mật khẩu mới: ${newPassword}`);

        res.json({
            success: true,
            message: 'Đổi mật khẩu thành công'
        });
        
    } catch (error) {
        logger.error('[Config] Error changing password: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đổi mật khẩu'
        });
    }
});

/**
 * Helper function: Update .env file
 */
async function updateEnvFile(accessToken, refreshToken) {
    try {
        const envPath = path.join(__dirname, '../../.env');
        let envContent = await fs.readFile(envPath, 'utf8');
        
        // Update EWELINK_TOKEN
        if (envContent.includes('EWELINK_TOKEN=')) {
            envContent = envContent.replace(
                /EWELINK_TOKEN=.*/,
                `EWELINK_TOKEN=${accessToken}`
            );
        } else {
            envContent += `\nEWELINK_TOKEN=${accessToken}`;
        }
        
        // Update EWELINK_REFRESHTOKEN
        if (envContent.includes('EWELINK_REFRESHTOKEN=')) {
            envContent = envContent.replace(
                /EWELINK_REFRESHTOKEN=.*/,
                `EWELINK_REFRESHTOKEN=${refreshToken}`
            );
        } else {
            envContent += `\nEWELINK_REFRESHTOKEN=${refreshToken}`;
        }
        
        await fs.writeFile(envPath, envContent, 'utf8');
        logger.info('[Config] File .env đã được cập nhật');
        
    } catch (error) {
        logger.error('[Config] Error updating .env file: ' + error.message);
        throw error;
    }
}

module.exports = router;
