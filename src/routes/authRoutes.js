const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const router = express.Router();

// Xử lý đăng nhập (POST)
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin'
            });
        }

        // Tìm user trong database
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }

        const user = rows[0];

        // Kiểm tra mật khẩu
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }

        // Đăng nhập thành công - Lưu vào session
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            full_name: user.full_name
        };

        res.json({
            success: true,
            message: 'Đăng nhập thành công',
            user: {
                username: user.username,
                role: user.role,
                full_name: user.full_name
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống. Vui lòng thử lại sau.'
        });
    }
});

// Đăng xuất
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi khi đăng xuất'
            });
        }
        res.json({
            success: true,
            message: 'Đăng xuất thành công'
        });
    });
});

module.exports = router;
