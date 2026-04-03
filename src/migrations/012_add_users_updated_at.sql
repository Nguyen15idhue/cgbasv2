-- Migration: 012_add_users_updated_at.sql
-- Thêm cột updated_at cho bảng users

ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER password;
