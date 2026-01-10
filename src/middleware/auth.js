const logger = require('../utils/logger');

/**
 * Middleware requireAuth - "Cánh cổng" kiểm soát truy cập
 * 
 * Nhiệm vụ:
 * 1. Kiểm tra xem user đã đăng nhập chưa (req.session.user)
 * 2. Phân loại request:
 *    - Browser request (HTML) -> Redirect về /login
 *    - API request (JSON) -> Trả về 401 Unauthorized
 */
function requireAuth(req, res, next) {
    // Kiểm tra session
    if (req.session && req.session.user) {
        // User đã đăng nhập -> Cho phép đi tiếp
        logger.info(`[Auth] User ${req.session.user.username} truy cập: ${req.method} ${req.originalUrl}`);
        return next();
    }

    // User chưa đăng nhập
    logger.warn(`[Auth] Truy cập trái phép: ${req.method} ${req.originalUrl} từ ${req.ip}`);

    // Phân loại request: API hay Browser?
    const isApiRequest = req.originalUrl.startsWith('/api/') || 
                         req.xhr || 
                         req.headers.accept?.includes('application/json');

    if (isApiRequest) {
        // API Request -> Trả về JSON
        return res.status(401).json({
            success: false,
            message: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
            code: 'UNAUTHORIZED'
        });
    } else {
        // Browser Request -> Redirect về trang login
        return res.redirect('/login');
    }
}

/**
 * Middleware kiểm tra quyền Admin (Nâng cao - Tùy chọn)
 */
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Chưa đăng nhập'
        });
    }

    if (req.session.user.role !== 'ADMIN') {
        logger.warn(`[Auth] User ${req.session.user.username} không có quyền Admin`);
        return res.status(403).json({
            success: false,
            message: 'Không có quyền truy cập'
        });
    }

    next();
}

module.exports = { requireAuth, requireAdmin };
