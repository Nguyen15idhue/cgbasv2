const bcrypt = require('bcryptjs');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Controller xử lý đăng nhập
 */
async function login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Vui lòng nhập đầy đủ thông tin'
        });
    }

    try {
        // Tìm user trong database
        const [rows] = await require('../config/database').execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            logger.warn(`[Auth] Đăng nhập thất bại: Username không tồn tại - ${username}`);
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }

        const user = rows[0];

        // So sánh mật khẩu đã mã hóa
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            logger.warn(`[Auth] Đăng nhập thất bại cho user: ${username}`);
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }

        // 3. Tạo session cho user
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            full_name: user.full_name
        };

        logger.info(`[Auth] User ${username} đăng nhập thành công từ ${req.ip}`);

        res.json({
            success: true,
            message: 'Đăng nhập thành công',
            user: {
                username: user.username,
                fullName: user.full_name,
                role: user.role
            }
        });

    } catch (error) {
        logger.error('[Auth Login Error]: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống'
        });
    }
}

/**
 * API Logout
 */
async function logout(req, res) {
    const username = req.session?.user?.username || 'Unknown';
    
    req.session.destroy((err) => {
        if (err) {
            logger.error('[Auth] Lỗi khi logout: ' + err.message);
            return res.status(500).json({ success: false, message: 'Lỗi đăng xuất' });
        }
        
        logger.info(`[Auth] User ${username} đã đăng xuất`);
        res.clearCookie('cgbas_session');
        res.json({ success: true, message: 'Đăng xuất thành công' });
    });
}

/**
 * API: Lấy thông tin user hiện tại
 */
async function getCurrentUser(req, res) {
    if (req.session && req.session.user) {
        return res.json({
            success: true,
            user: {
                username: req.session.user.username,
                fullName: req.session.user.full_name,
                role: req.session.user.role
            }
        });
    }
    res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
}

module.exports = { login, logout, getCurrentUser };
