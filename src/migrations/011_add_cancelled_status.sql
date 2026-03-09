-- Thêm giá trị 'cancelled' vào ENUM status của scheduled_shutdown_history
ALTER TABLE scheduled_shutdown_history 
MODIFY COLUMN status ENUM('running', 'completed', 'failed', 'cancelled') DEFAULT 'running';
