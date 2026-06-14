-- Migration: 016_add_gga_frequency_to_ntrip_config.sql
-- Thêm cột gga_frequency cho cấu hình tần suất gửi GGA

ALTER TABLE ntrip_config
ADD COLUMN gga_frequency VARCHAR(10) DEFAULT '1hz'
AFTER is_active;

-- Verify
SELECT station_id, gga_frequency FROM ntrip_config;
