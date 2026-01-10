const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

// ========== PUBLIC ROUTES (Không cần đăng nhập) ==========

// Trang đăng nhập (GET)
router.get('/login', (req, res) => {
    // Nếu đã đăng nhập rồi thì redirect về trang chủ
    if (req.session && req.session.user) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, '../views/login.html'));
});

// API đăng nhập (POST)
router.post('/api/auth/login', authController.login);

// API logout
router.post('/api/auth/logout', authController.logout);

module.exports = router;
