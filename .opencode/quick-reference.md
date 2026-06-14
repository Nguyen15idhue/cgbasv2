# Quick Reference - CGBAS V2

## Tech Stack
- **Backend:** Node.js 20 + Express 5.2.1
- **Database:** MySQL 8.0 (mysql2/promise)
- **Frontend:** Vanilla JS SPA + Bootstrap 5
- **IoT:** eWelink API
- **New:** Go NTRIP Client Service

## Key Files
| File | Purpose |
|------|---------|
| `src/main.js` | Entry point |
| `src/config/database.js` | MySQL pool |
| `src/utils/scheduler.js` | Cron jobs |
| `src/utils/autoMonitor.js` | Recovery detection |
| `src/repository/stationRepo.js` | Station data |
| `src/services/stationControlService.js` | Recovery logic |
| `public/js/stations.js` | Station UI |

## Status Values
```
connectStatus: 0=Not connected, 1=Online, 2=NoData, 3=Offline
status_source: 'cgbas' | 'ntrip'
recovery status: PENDING, RUNNING, CHECKING, SUCCESS, FAILED, SKIPPED
```

## API Response Format
```javascript
{ success: true, data: ... }
{ success: false, message: "error" }
```

## Naming Conventions
- Files: camelCase (`stationRepo.js`)
- Constants: UPPER_SNAKE (`OFFLINE_THRESHOLD`)
- Routes: kebab-case (`/api/recovery-history`)
- DB tables: snake_case (`station_dynamic_info`)

## Commands
```bash
npm start                    # Start server
node src/migrations/index.js # Run migrations
docker-compose up -d         # Start all services
docker-compose logs -f       # View logs
```

## NTRIP Integration
- Plan: `docs/plan/NTRIP-INTEGRATION-PLAN.md`
- Tasks: `docs/plan/NTRIP-TASKS.md`
- Go service: `ntrip-client/`
- New tables: `ntrip_config`, `ntrip_logs`
