# Project Instructions for OpenCode

## Dự án CGBAS V2

**CGBAS V2** là hệ thống quản lý trạm GNSS RTK, bao gồm:
- **Backend:** Node.js (Express 5) + MySQL 8.0
- **Frontend:** Vanilla JavaScript SPA (Bootstrap 5)
- **IoT:** eWelink API integration
- **Monitoring:** Auto-recovery mechanism
- **Mới:** NTRIP Client Service (Go)

## Mục tiêu tích hợp NTRIP

Cho phép mỗi trạm GNSS lựa chọn 1 trong 2 nguồn dữ liệu trạng thái:
1. **CGBAS PRO** (hiện tại): Đọc từ cloud API của CGBAS
2. **NTRIP Client** (mới): Đọc trực tiếp từ NTRIP Caster qua Go service

Nguyên tắc: Mỗi trạm chỉ thuộc 1 nguồn, dữ liệu lưu vào cùng bảng `station_dynamic_info`.

## Quy tắc khi làm việc với dự án này

### 1. Luôn đọc file liên quan trước khi sửa
- Trước khi sửa file nào, đọc file đó và các file liên quan
- Kiểm tra pattern hiện tại trong codebase

### 2. Tuân thủ naming conventions
- Backend files: camelCase (`stationRepo.js`, `stationControlService.js`)
- SQL migrations: `NNN_snake_case_description.sql`
- Frontend files: camelCase (`dashboard.js`, `stations.js`)
- CSS files: lowercase (`master.css`, `stations.css`)
- Constants: UPPER_SNAKE_CASE (`OFFLINE_THRESHOLD`, `MAX_RETRIES`)
- API routes: kebab-case (`/api/recovery-history`)

### 3. API Response Format
Luôn trả về format:
```javascript
// Success
{ success: true, data: ..., message: "..." }

// Error
{ success: false, message: "..." }
```

### 4. Database Patterns
- Dùng `db.execute(sql, params)` cho prepared statements
- Dùng `db.query(sql, params)` cho dynamic queries
- Luôn parameterize queries (không concat string)
- Repository pattern: `stationRepo.js`, `ewelinkRepo.js`

### 5. Error Handling
- Route handlers: wrap trong try/catch
- Async functions: dùng `async/await`
- Log errors bằng Winston logger
- Trả error response với `res.status(500).json({ success: false, message: err.message })`

### 6. Go Service Patterns
- Standard Go project layout
- Use `database/sql` + `go-sql-driver/mysql`
- Environment variables via `os.Getenv()`
- Graceful shutdown với context
- Structured logging (slog)

### 7. Testing
- Manual testing: `test-ewelink.js`
- Stress test: `scripts/stress-recovery-concurrency.js`
- Verify bằng MySQL queries trực tiếp

### 8. Deployment
- Docker multi-stage build
- Docker Compose profiles: `dev`, `prod`
- Health check endpoint: `/health`
- Non-root user trong production
