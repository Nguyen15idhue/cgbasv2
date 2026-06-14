-- Migration: 013_add_status_source_to_stations.sql
-- Thêm cột status_source cho bảng stations

ALTER TABLE stations 
ADD COLUMN status_source ENUM('cgbas','ntrip') DEFAULT 'cgbas' 
AFTER is_active;

UPDATE stations SET status_source = 'cgbas';
