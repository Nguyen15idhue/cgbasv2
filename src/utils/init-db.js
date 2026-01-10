// File: src/utils/init-db.js
require('dotenv').config(); // Load biến môi trường nếu có
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Lấy config trực tiếp từ process.env
const config = {
    MYSQL: {
        HOST: process.env.MYSQL_HOST || 'localhost',
        USER: process.env.MYSQL_USER || 'root',
        PASSWORD: process.env.MYSQL_PASSWORD || '',
        DATABASE: process.env.MYSQL_DATABASE || 'cgbas_db',
        PORT: process.env.MYSQL_PORT || 3306
    }
};

async function initDB() {
    console.log("🔄 Đang kết nối đến Database...");
    
    // Tạo connection riêng để chạy script này
    const connection = await mysql.createConnection({
        host: config.MYSQL.HOST,
        user: config.MYSQL.USER,
        password: config.MYSQL.PASSWORD,
        database: config.MYSQL.DATABASE,
        port: config.MYSQL.PORT
    });

    try {
        console.log("✅ Kết nối thành công!");

        // 1. TẠO BẢNG USERS (MIGRATION)
        console.log("🛠  Đang tạo bảng 'users'...");
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'ADMIN',
                full_name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;
        await connection.query(createTableQuery);
        console.log("   -> Bảng 'users' đã sẵn sàng.");

        // 2. TẠO TÀI KHOẢN ADMIN MẶC ĐỊNH (SEEDING)
        const adminUser = 'admin';
        const adminPass = 'admin123'; // Mật khẩu mặc định
        const adminName = 'Quản trị viên';

        // Kiểm tra xem admin đã tồn tại chưa
        const [rows] = await connection.query('SELECT * FROM users WHERE username = ?', [adminUser]);
        
        if (rows.length === 0) {
            console.log(`🌱 Đang tạo tài khoản Admin mặc định (${adminUser})...`);
            
            // Mã hóa mật khẩu (Salt round = 10)
            const hashedPassword = await bcrypt.hash(adminPass, 10);

            await connection.query(
                'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)',
                [adminUser, hashedPassword, 'ADMIN', adminName]
            );
            
            console.log("✅ Đã tạo tài khoản thành công!");
            console.log("   ----------------------------------------");
            console.log(`   👤 Username: ${adminUser}`);
            console.log(`   🔑 Password: ${adminPass}`);
            console.log("   ----------------------------------------");
        } else {
            console.log("ℹ️  Tài khoản Admin đã tồn tại. Bỏ qua bước tạo.");
        }

    } catch (error) {
        console.error("❌ Lỗi khởi tạo DB:", error.message);
    } finally {
        await connection.end();
        console.log("👋 Đã đóng kết nối.");
    }
}

// Chạy hàm
initDB();