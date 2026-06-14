# Architecture Overview - CGBAS V2

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE                           │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │   MySQL    │  │  Node.js   │  │  Go Service │  │           │ │
│  │   8.0      │  │  (cgbasv2) │  │  (ntrip)    │  │           │ │
│  │            │  │            │  │             │  │           │ │
│  │ ◄──────────┼──┤  Scheduler │  │  NTRIP      │  │           │ │
│  │   write    │  │  (cgbas)   │  │  Client     │  │           │ │
│  │            │  │            │  │             │  │           │ │
│  │ ◄──────────┼──┤            ├──┼► push DB    │  │           │ │
│  │   read     │  │            │  │             │  │           │ │
│  │            │  │            │  │             │  │           │ │
│  │ ───────────┼──┼────────────┼──┼─────────────┼─┤           │ │
│  │            │  │ AutoMonitor│  │ REST API    │  │           │ │
│  │            │  │ + Recovery │  │ /health     │  │           │ │
│  └────────────┘  └────────────┘  └─────────────┘  └───────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### MySQL 8.0
- Store all persistent data
- Connection pool: 10 connections
- Charset: utf8mb4_unicode_ci
- Tables: 15+ tables for stations, recovery, eWelink, scheduling

### Node.js Backend (cgbasv2)
- **Entry Point:** `src/main.js`
- **Framework:** Express 5.2.1
- **Responsibilities:**
  - REST API endpoints
  - Authentication (session-based)
  - Scheduler (node-cron)
  - Auto-monitoring & recovery
  - eWelink IoT integration
  - CGBAS PRO API integration

### Go Service (ntrip-client) - MỚI
- **Entry Point:** `main.go`
- **Responsibilities:**
  - NTRIP protocol client
  - Connect to NTRIP Caster
  - Parse RTCM/NMEA data
  - Detect station status (Online/NoData/Offline)
  - Push data to MySQL
  - Health check endpoint

## Data Flow

### CGBAS Source (Hiện tại)
```
CGBAS PRO API
    │
    ▼
Node.js Scheduler (5s)
    │
    ▼
MySQL (station_dynamic_info)
    │
    ▼
AutoMonitor → Recovery
```

### NTRIP Source (Mới)
```
NTRIP Caster
    │
    ▼
Go Service (NTRIP Client)
    │
    ▼
MySQL (station_dynamic_info)
    │
    ▼
AutoMonitor → Recovery
```

## Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `stations` | Station info (ID, name, location, status_source) |
| `station_dynamic_info` | Real-time status (connectStatus, satellites, delay) |
| `station_recovery_jobs` | Active recovery queue |
| `station_recovery_history` | Recovery attempt history |

### eWelink Tables
| Table | Purpose |
|-------|---------|
| `ewelink_devices` | IoT device registry |
| `ewelink_status` | Device relay status |
| `ewelink_config` | App credentials & tokens |
| `ewelink_api_logs` | API call logs |

### NTRIP Tables (Mới)
| Table | Purpose |
|-------|---------|
| `ntrip_config` | NTRIP connection settings per station |
| `ntrip_logs` | NTRIP events (connect, disconnect, error) |

### Status Values
```
connectStatus:
  0 - Chưa kết nối (Not connected)
  1 - Online ✅
  2 - Chưa định vị / No Data
  3 - Offline ❌
```

## Key Flows

### Recovery Flow
```
1. AutoMonitor (every 5s)
   └─► Detect: connectStatus = 3 AND offline_duration >= 30s
   
2. Create Recovery Job
   └─► INSERT INTO station_recovery_jobs (status = 'PENDING')
   
3. Claim Job (with advisory lock)
   └─► UPDATE status = 'RUNNING'
   
4. Execute Recovery
   └─► Check eWelink device status
   └─► Toggle channels (on/off/on)
   └─► Wait 90s
   └─► Verify connectStatus = 1
   
5. Complete
   └─► SAVE to station_recovery_history
   └─► DELETE from station_recovery_jobs
```

### NTRIP Connection Flow
```
1. Startup
   └─► Query DB: stations WHERE status_source = 'ntrip'
   
2. For each station
   └─► Connect to NTRIP Caster (URL + mountpoint + auth)
   └─► Start goroutine for data streaming
   
3. Data Processing
   └─► Parse NMEA → Extract satellites
   └─► Detect status (Online/NoData/Offline)
   └─► Upsert to station_dynamic_info
   
4. Reconnection
   └─► On disconnect: wait 30s
   └─► Retry up to 5 times
   └─► Log events to ntrip_logs
```

## File Structure

```
cgbasv2/
├── src/                        # Node.js Backend
│   ├── main.js                 # Entry point
│   ├── config/
│   │   └── database.js         # MySQL connection pool
│   ├── controllers/
│   │   └── authController.js   # Auth logic
│   ├── middleware/
│   │   └── auth.js             # requireAuth, requireAdmin
│   ├── migrations/
│   │   ├── index.js            # Migration runner
│   │   └── NNN_*.sql           # SQL migrations
│   ├── repository/
│   │   ├── stationRepo.js      # Station data access
│   │   └── ewelinkRepo.js      # eWelink data access
│   ├── routes/
│   │   ├── stationRoutes.js    # /api/stations/*
│   │   ├── ewelinkRoutes.js    # /api/ewelink/*
│   │   └── ...                 # Other routes
│   ├── services/
│   │   ├── cgbasApi.js         # CGBAS API client
│   │   ├── ewelinkService.js   # eWelink API client
│   │   └── stationControlService.js  # Recovery logic
│   └── utils/
│       ├── autoMonitor.js      # Offline detection
│       ├── scheduler.js        # Cron jobs
│       └── logger.js           # Winston logger
│
├── ntrip-client/               # Go Service (MỚI)
│   ├── main.go
│   ├── go.mod
│   ├── config/
│   ├── models/
│   ├── repository/
│   ├── ntrip/
│   └── api/
│
├── public/                     # Frontend (SPA)
│   ├── index.html              # SPA shell
│   ├── partials/               # Page content
│   ├── js/                     # Page scripts
│   ├── css/                    # Page styles
│   └── components/             # Reusable components
│
├── docs/                       # Documentation
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── deploy/
│   ├── function/
│   ├── guides/
│   └── plan/
│
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Environment Variables

### Node.js Backend
```bash
# Database
DB_HOST=localhost
DB_PORT=3307
DB_NAME=cgbas_db
DB_USER=root
DB_PASS=password

# Session
SESSION_SECRET=your-secret-key

# eWelink
EWELINK_API_URL=https://api2.ewelink.com

# Telegram (optional)
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx
```

### Go Service (NTRIP)
```bash
# Database
DB_HOST=mysql
DB_PORT=3306
DB_NAME=cgbas_db
DB_USER=root
DB_PASS=password

# NTRIP
NTRIP_POLL_INTERVAL=5
NTRIP_RECONNECT_DELAY=30
NTRIP_DATA_TIMEOUT=30
```

## API Endpoints

### Node.js Backend
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/stations | List stations |
| GET | /api/stations/:id | Station detail |
| POST | /api/stations/:id/recover | Trigger recovery |
| GET | /api/reports/summary | Report summary |
| GET | /api/ewelink/devices | List devices |
| POST | /api/ewelink/control | Control device |

### Go Service (NTRIP)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /api/ntrip/stations | List NTRIP stations |
| GET | /api/ntrip/status/:id | Station status |
