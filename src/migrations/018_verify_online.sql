ALTER TABLE scheduled_shutdown_details
    ADD COLUMN verified_online TINYINT NULL COMMENT '1 online lai, 0 van offline, NULL chua toi gio check',
    ADD COLUMN verified_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Thoi diem verify',
    ADD COLUMN verified_status TINYINT NULL COMMENT 'connectStatus quan sat duoc luc verify';

ALTER TABLE scheduled_shutdown_config
    ADD COLUMN verify_enabled BOOLEAN DEFAULT TRUE COMMENT 'Bat/tat verify online lai',
    ADD COLUMN verify_delay_minutes INT DEFAULT 10 COMMENT 'So phut cho sau pha bat truoc khi verify';
