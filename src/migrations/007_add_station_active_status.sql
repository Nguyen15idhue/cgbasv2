-- Add is_active column to stations table for enable/disable functionality
ALTER TABLE stations 
ADD COLUMN is_active TINYINT(1) DEFAULT 1 COMMENT 'Trạng thái kích hoạt: 1=Enabled, 0=Disabled';

-- Add index for better query performance
CREATE INDEX idx_station_active ON stations(is_active);
