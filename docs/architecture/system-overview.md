# 🏗️ System Architecture

Kiến trúc tổng quan của hệ thống CGBAS v2.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Client                          │
│              (Dashboard, Stations, Queue, Logs...)              │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS/HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Express.js Server                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Routes     │  │ Middleware   │  │  Controllers │         │
│  │              │  │ - Auth       │  │              │         │
│  │ - /api/auth  │  │ - Session    │  │ - Auth       │         │
│  │ - /api/      │  │ - Logging    │  │              │         │
│  │   stations   │  └──────────────┘  └──────────────┘         │
│  │ - /api/      │                                               │
│  │   ewelink    │                                               │
│  └──────────────┘                                               │
└────────────┬───────────────────────┬──────────────────┬─────────┘
             │                       │                  │
             ▼                       ▼                  ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────┐
│   Services Layer     │  │  Repositories    │  │   Utils      │
│                      │  │                  │  │              │
│ - cgbasApi           │  │ - stationRepo    │  │ - logger     │
│ - ewelinkService     │  │ - ewelinkRepo    │  │ - crypto     │
│ - stationControl     │  │                  │  │ - helper     │
│   Service            │  │                  │  │ - scheduler  │
│                      │  │                  │  │ - autoMonitor│
└──────┬───────────────┘  └────────┬─────────┘  └──────┬───────┘
       │                           │                    │
       │    ┌──────────────────────┴────────────────────┘
       │    │                           │
       ▼    ▼                           ▼
┌────────────────┐           ┌──────────────────┐
│  MySQL DB      │           │  Cron Scheduler  │
│                │           │                  │
│ - stations     │           │ Every 15s:       │
│ - recovery_*   │           │ - Sync CGBAS     │
│ - ewelink_*    │           │ - Monitor offline│
│ - users        │           │ - Run jobs       │
└────────────────┘           └──────────────────┘
       ▲                              │
       │    ┌─────────────────────────┘
       │    │
       │    ▼
       │  ┌──────────────────────────────┐
       │  │   Auto Recovery Engine       │
       │  │                              │
       │  │ 1. Detect offline stations   │
       │  │ 2. Create recovery jobs      │
       │  │ 3. Execute with retry        │
       │  │ 4. Verify result             │
       │  │ 5. Save history              │
       │  └──────────────────────────────┘
       │              ▲
       └──────────────┘

External APIs:
┌──────────────────┐         ┌──────────────────┐
│  CGBAS PRO API   │         │   eWelink Cloud  │
│  - /stations     │         │   - /things      │
│  - /dynamic-info │         │   - /switch      │
└──────────────────┘         └──────────────────┘
```

---

## Component Layers

### 1. **Presentation Layer** (Frontend)

**Technologies**: HTML5, CSS3, Vanilla JavaScript

**Pages:**
- `/login` - Authentication
- `/dashboard` - Overview stats
- `/stations` - Station management
- `/devices` - eWelink device control
- `/queue` - Recovery queue monitoring
- `/logs` - System logs viewer
- `/settings` - System configuration

**Features:**
- Session-based authentication
- Real-time data refresh
- Responsive design
- Interactive charts (optional)

---

### 2. **API Layer** (Routes)

**Location**: `src/routes/`

| Route File | Base Path | Purpose |
|------------|-----------|---------|
| authRoutes.js | /api/auth | Authentication endpoints |
| stationRoutes.js | /api/stations | Station management & recovery |
| ewelinkRoutes.js | /api/ewelink | Device control & monitoring |

**Middleware Stack:**
```javascript
Request → Logging → Session Check → requireAuth → Route Handler → Response
```

---

### 3. **Business Logic Layer** (Services)

**Location**: `src/services/`

#### **cgbasApi.js**
- Integrate với CGBAS PRO API
- Generate authentication signatures
- Fetch stations & dynamic info

#### **ewelinkService.js**
- Integrate với eWelink Cloud API
- Device control (toggle channels)
- API logging với interceptors

#### **stationControlService.js**
- Auto-recovery orchestration
- Retry mechanism (step + adaptive)
- Job scheduling & history tracking

---

### 4. **Data Access Layer** (Repositories)

**Location**: `src/repository/`

#### **stationRepo.js**
```javascript
- upsertStations(records)
- upsertDynamicInfo(data)
- getAllStationIds()
```

#### **ewelinkRepo.js**
```javascript
- upsertEwelinkDevice(device)
- updateDeviceStatus(deviceid, status)
```

**Pattern**: Repository pattern để abstract database operations.

---

### 5. **Infrastructure Layer** (Utils)

**Location**: `src/utils/`

#### **scheduler.js**
- Cron jobs (15s sync cycle)
- Task orchestration
- Error handling

#### **autoMonitor.js**
- Detect offline stations
- Create recovery jobs
- Trigger job execution

#### **logger.js**
- Winston-based logging
- Daily rotate files
- Separate error logs

#### **helper.js**
- Sleep function
- Retry action with exponential backoff

#### **crypto.js**
- CGBAS signature generation
- HMAC-SHA256 implementation

---

## Data Flow

### 1. Station Monitoring Flow

```
[CGBAS PRO API]
       ↓
fetchStations() + fetchDynamicInfo()
       ↓
upsertStations() + upsertDynamicInfo()
       ↓
[MySQL Database]
       ↓
checkAndTriggerRecovery() (Every 15s)
       ↓
Detect: connectStatus = 3 && ewelink_device_id != NULL
       ↓
Create station_recovery_jobs
```

### 2. Recovery Execution Flow

```
Scheduler picks job (next_run_time <= NOW)
       ↓
runAutoRecovery(job)
       ↓
Check eWelink device online
       ↓
Execute scenario with retry
  - Bật nguồn (Kênh 1)
  - Đợi 10s
  - Kích nút (Kênh 2)
  - Đợi 5s
  - Nhả nút
       ↓
Wait 2 minutes
       ↓
Verify CGBAS connectStatus
       ↓
SUCCESS → Save history → Delete job
FAILED → Reschedule (2,5,10,15,30,60 min)
```

### 3. API Request Flow

```
Browser
   ↓
POST /api/auth/login
   ↓
Validate credentials
   ↓
Create session
   ↓
Set-Cookie: cgbas_session
   ↓
Subsequent requests include cookie
   ↓
requireAuth middleware checks session
   ↓
Access granted to protected routes
```

---

## Technology Stack

### Backend

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express.js | 5.x |
| Database | MySQL | 8.0+ |
| Auth | bcryptjs | 3.x |
| Session | express-session | 1.x |
| HTTP Client | axios | 1.x |
| Scheduler | node-cron | 4.x |
| Logging | winston | 3.x |
| Crypto | crypto-js | 4.x |

### Frontend

| Component | Technology |
|-----------|------------|
| HTML | HTML5 |
| CSS | CSS3 (Custom) |
| JavaScript | Vanilla JS (ES6+) |
| Icons | Font Awesome (optional) |

### Database

```
MySQL 8.0+
├── InnoDB engine
├── utf8mb4_unicode_ci
└── ACID compliance
```

---

## Security Architecture

### Authentication

```
Password → bcrypt hash (salt=10) → Database
                ↓
           Verify on login
                ↓
        Create session in memory
                ↓
     Set HttpOnly cookie (24h TTL)
```

### Session Management

```javascript
{
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: NODE_ENV === 'production'
  }
}
```

### API Security

**CGBAS PRO:**
- HMAC-SHA256 signature
- Nonce + Timestamp
- Access Key + Secret Key

**eWelink:**
- Bearer token authentication
- HTTPS only

---

## Scalability Considerations

### Current Limitations

| Resource | Limit | Bottleneck |
|----------|-------|------------|
| Concurrent Jobs | ~20 | Single-threaded execution |
| API Rate | ~60/min | eWelink cloud limits |
| Session Storage | Memory | No persistence across restarts |
| Database | Single instance | No replication |

### Recommended Improvements

1. **Job Queue**: Use Redis + Bull for distributed job processing
2. **Session Store**: Redis for persistent sessions
3. **Database**: Master-slave replication
4. **Caching**: Redis cache for station data
5. **Load Balancer**: Nginx for horizontal scaling

---

## Monitoring & Observability

### Logging

```
src/logs/
├── app-2026-01-11.log          # Application logs
├── error-2026-01-11.log        # Error logs
└── (Auto-rotate daily)
```

### Metrics (To be implemented)

- Request count per endpoint
- Average response time
- Success/failure rate
- Job completion time
- Database query performance

### Health Checks

```javascript
GET /api/dashboard/stats
→ Returns system health indicators
```

---

## Deployment Architecture

### Development

```
localhost:3000
├── Node.js (single process)
├── MySQL (local)
└── Manual restarts
```

### Production (Recommended)

```
                   ┌────────────┐
                   │   Nginx    │
                   │   (Reverse │
                   │    Proxy)  │
                   └──────┬─────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
    ┌──────────┐                    ┌──────────┐
    │  Node.js │                    │  Node.js │
    │  (PM2)   │                    │  (PM2)   │
    │  Process │                    │  Process │
    └────┬─────┘                    └────┬─────┘
         │                               │
         └───────────────┬───────────────┘
                         ▼
                  ┌─────────────┐
                  │   MySQL     │
                  │  (Master)   │
                  └─────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   Redis     │
                  │  (Sessions) │
                  └─────────────┘
```

---

**Related:**
- [Data Flow](./data-flow.md)
- [Recovery Mechanism](./recovery-mechanism.md)
- [Deployment Guide](../guides/deployment.md)
