# Coding Conventions - CGBAS V2

## 1. JavaScript/Node.js Conventions

### Module System
- **CommonJS** (`require()` / `module.exports`) - KHÔNG dùng ES Modules
- Chỉ dùng dynamic import() cho `ewelink-api-next` package

### Naming
```javascript
// Files - camelCase
stationRepo.js
stationControlService.js
autoMonitor.js

// Functions - camelCase
async function fetchStations() {}
function upsertDynamicInfo() {}
const runAutoRecovery = async () => {}

// Variables - camelCase
const activeStations = [];
let reconnectAttempts = 0;

// Constants - UPPER_SNAKE_CASE
const OFFLINE_THRESHOLD = 30;
const MAX_RETRIES = 5;
const RECOVERY_MAX_CONCURRENT_JOBS = 10;

// DB tables - snake_case
station_dynamic_info
ewelink_api_logs
station_recovery_jobs

// DB columns - mixed (theo schema hiện tại)
stationName (camelCase)
ewelink_device_id (snake_case)
connectStatus (camelCase)
first_offline_at (snake_case)

// API routes - kebab-case
/api/stations/recovery-history
/api/scheduled-shutdown/config
```

### File Organization
```
src/
├── main.js                    # Entry point
├── config/
│   └── database.js            # DB connection pool
├── controllers/
│   └── authController.js      # Auth logic
├── middleware/
│   └── auth.js                # requireAuth, requireAdmin
├── migrations/
│   └── NNN_description.sql    # SQL migrations
├── repository/
│   └── stationRepo.js         # Data access layer
├── routes/
│   └── stationRoutes.js       # Express routes
├── services/
│   └── stationControlService.js  # Business logic
└── utils/
    └── autoMonitor.js         # Utility functions
```

### Export Pattern
```javascript
// Named exports (preferred)
module.exports = { func1, func2, func3 };

// Single export (for services/classes)
class StationControlService { ... }
module.exports = new StationControlService();
```

### Async/Await Pattern
```javascript
// ALWAYS use async/await, NEVER raw callbacks
async function getData() {
    try {
        const [rows] = await db.execute('SELECT * FROM stations WHERE id = ?', [id]);
        return rows;
    } catch (err) {
        logger.error(`Error: ${err.message}`);
        throw err;
    }
}
```

### Route Handler Pattern
```javascript
router.get('/endpoint', async (req, res) => {
    try {
        // Business logic
        const result = await someService.doSomething();
        
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
```

### Database Query Pattern
```javascript
// Prepared statements - ALWAYS use ? placeholders
const [rows] = await db.execute(
    'SELECT * FROM stations WHERE id = ? AND is_active = ?',
    [stationId, 1]
);

// Batch operations
const values = stations.map(s => [s.id, s.name, s.status]);
await db.query(
    'INSERT INTO stations (id, name, status) VALUES ?',
    [values]
);
```

---

## 2. SQL Conventions

### Migration Files
```sql
-- File: src/migrations/013_add_status_source_to_stations.sql
-- Format: NNN_description.sql (3 digits, snake_case)

ALTER TABLE stations 
ADD COLUMN status_source ENUM('cgbas','ntrip') DEFAULT 'cgbas' 
AFTER is_active;
```

### Table Creation
```sql
CREATE TABLE IF NOT EXISTS table_name (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_station_id (station_id),
    FOREIGN KEY (station_id) REFERENCES parent_table(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Query Style
```sql
-- Uppercase keywords
SELECT column1, column2
FROM table_name
WHERE condition = 'value'
ORDER BY column1 ASC
LIMIT 10;

-- Multi-line for complex queries
SELECT 
    s.id,
    s.station_name,
    d.connectStatus,
    d.delay
FROM stations s
JOIN station_dynamic_info d ON s.id = d.stationId
WHERE s.is_active = 1;
```

---

## 3. Go Conventions (NTRIP Service)

### Project Layout
```
ntrip-client/
├── main.go              # Entry point
├── go.mod               # Module definition
├── config/
│   └── config.go        # Configuration loading
├── models/
│   └── station.go       # Data structures
├── repository/
│   └── mysql.go         # Database operations
├── ntrip/
│   └── client.go        # NTRIP protocol client
└── api/
    └── handlers.go      # HTTP handlers
```

### Naming
```go
// Files - lowercase, underscore
station.go
mysql.go
client.go

// Functions - PascalCase (exported), camelCase (unexported)
func GetActiveStations() {}
func connectToCaster() {}

// Variables - camelCase
var activeStations map[string]*NtripClient
dbConnection := initDB()

// Constants - PascalCase or camelCase
const DefaultTimeout = 30
const maxRetries = 5

// Structs - PascalCase
type NtripConfig struct {
    StationID string
    NtripURL  string
}
```

### Error Handling
```go
// Always check errors
result, err := db.Exec(query, args...)
if err != nil {
    log.Printf("Error executing query: %v", err)
    return err
}

// Wrap errors with context
if err := connect(); err != nil {
    return fmt.Errorf("failed to connect to NTRIP caster: %w", err)
}
```

### Structured Logging
```go
import "log/slog"

slog.Info("Connected to NTRIP station",
    "station_id", stationID,
    "url", ntripURL,
    "mountpoint", mountpoint,
)

slog.Error("Connection failed",
    "station_id", stationID,
    "error", err,
)
```

---

## 4. Frontend Conventions

### HTML Partials
- Located in `public/partials/`
- Loaded via AJAX into `#mainContent`
- Use semantic HTML5 elements

### JavaScript (Vanilla)
```javascript
// Global functions on window object
window.loadStations = async function() { ... };

// Event listeners
document.getElementById('btn').addEventListener('click', handler);

// Fetch with auth check
async function apiCall(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 401) {
        window.location.href = '/login';
        return;
    }
    return response.json();
}
```

### CSS
- One CSS file per page
- Use Bootstrap 5 classes
- Custom classes: kebab-case (`.station-card`, `.status-badge`)
- Avoid `!important`

---

## 5. Docker Conventions

### Dockerfile
```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
USER nodejs
CMD ["node", "src/main.js"]
```

### Docker Compose
```yaml
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
    ports:
      - "3000:3000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```
