const axios = require('axios');
const CryptoJS = require('crypto-js');
const logger = require('../utils/logger');
const db = require('../config/database');
require('dotenv').config();

const randomString = (length) => {
    return [...Array(length)].map(_=>(Math.random()*36|0).toString(36)).join('');
};

function convertTimestampToDate(timestamp) {
    if (!timestamp) return null;
    return new Date(timestamp);
}

function generateAuthorization(appId, appSecret, timestamp) {
    const sign = CryptoJS.HmacSHA256(`${appId}${timestamp}`, appSecret).toString();
    return `${appId}.${timestamp}.${sign}`;
}

async function getConfigFromDB() {
    const [rows] = await db.execute('SELECT * FROM ewelink_config LIMIT 1');
    if (rows.length > 0) {
        return {
            appId: rows[0].app_id,
            appSecret: rows[0].app_secret,
            apiUrl: rows[0].api_url,
            accessToken: rows[0].access_token,
            refreshToken: rows[0].refresh_token,
            tokenExpiry: rows[0].token_expiry,
            refreshTokenExpiry: rows[0].refresh_token_expiry
        };
    }
    return null;
}

async function saveTokensToDB(accessToken, refreshToken, atExpiredTime, rtExpiredTime) {
    const [rows] = await db.execute('SELECT * FROM ewelink_config LIMIT 1');
    
    const atExpiry = convertTimestampToDate(atExpiredTime);
    const rtExpiry = convertTimestampToDate(rtExpiredTime);
    
    if (rows.length > 0) {
        await db.execute(
            `UPDATE ewelink_config 
            SET access_token = ?, refresh_token = ?, token_expiry = ?, refresh_token_expiry = ?, updated_at = NOW()
            WHERE id = ?`,
            [accessToken, refreshToken, atExpiry, rtExpiry, rows[0].id]
        );
    } else {
        await db.execute(
            `INSERT INTO ewelink_config (app_id, app_secret, api_url, access_token, refresh_token, token_expiry, refresh_token_expiry)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                process.env.EWELINK_APPID || '',
                process.env.EWELINK_APPSECRET || '',
                process.env.EWELINK_API || 'https://as-apia.coolkit.cc',
                accessToken, refreshToken, atExpiry, rtExpiry
            ]
        );
    }
    
    logger.info('[OAuth] Tokens đã được lưu vào database');
}

async function getLoginUrl(config) {
    const state = randomString(10);
    const loginUrl = `https://accounts.ewelink.cc/oauth/authorize?appid=${config.appId}&redirectUrl=${encodeURIComponent(config.redirectUrl)}&grantType=authorization_code&state=${state}`;
    return { loginUrl, state };
}

async function getTokenFromCode(code, region, config) {
    const apiUrl = config.apiUrl || `https://${region}-apia.coolkit.cc`;
    
    const response = await axios.post(`${apiUrl}/oauth/access_token`, {
        appid: config.appId,
        secret: config.appSecret,
        code: code,
        grantType: 'authorization_code'
    });
    
    return response.data;
}

async function refreshToken(config) {
    try {
        const apiUrl = config.apiUrl || 'https://as-apia.coolkit.cc';
        
        logger.info('[OAuth] Refresh - accessToken: ' + (config.accessToken ? 'exists' : 'empty'));
        logger.info('[OAuth] Refresh - refreshToken: ' + (config.refreshToken ? 'exists' : 'empty'));
        
        const response = await axios.post(`${apiUrl}/v2/user/refresh`, {
            rt: config.refreshToken
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-CK-Appid': config.appId
            }
        });
        
        if (response.data.error === 0 && response.data.data) {
            const { at, rt } = response.data.data;
            return { accessToken: at, refreshToken: rt };
        }
        
        throw new Error(response.data.msg || 'Refresh token failed');
    } catch (error) {
        logger.error('[OAuth] Lỗi refresh token: ' + error.message);
        throw error;
    }
}

async function autoRefreshToken() {
    try {
        const config = await getConfigFromDB();
        
        if (!config || !config.refreshToken) {
            logger.warn('[OAuth] Không có refresh token để làm mới');
            return { success: false, reason: 'no_refresh_token' };
        }
        
        const result = await refreshToken(config);
        
        const atExpiredTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
        const rtExpiredTime = Date.now() + (365 * 24 * 60 * 60 * 1000);
        
        await saveTokensToDB(result.accessToken, result.refreshToken, atExpiredTime, rtExpiredTime);
        
        const ewelinkService = require('./ewelinkService');
        if (ewelinkService.updateTokens) {
            ewelinkService.updateTokens(result.accessToken, result.refreshToken);
        }
        
        logger.info('[OAuth] Token đã được làm mới tự động');
        
        return { 
            success: true, 
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
        };
    } catch (error) {
        logger.error('[OAuth] Lỗi làm mới token tự động: ' + error.message);
        return { success: false, reason: error.message };
    }
}

module.exports = {
    getConfigFromDB,
    saveTokensToDB,
    getLoginUrl,
    getTokenFromCode,
    refreshToken,
    autoRefreshToken
};
