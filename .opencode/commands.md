# Common Commands & Workflows

> **QUAN TRỌNG:** Tất cả command đều chạy qua Docker (local & production)

## Container Names
- `cgbas-app` - Node.js backend
- `cgbas-mysql` - MySQL database  
- `cgbas-ntrip` - Go NTRIP service (mới)

## Development Commands

### Start Development
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d cgbas-app
docker-compose up -d cgbas-mysql

# Xem logs realtime
docker-compose logs -f cgbas-app
```

### Database Operations
```bash
# Run migrations
docker exec cgbas-app node src/migrations/index.js

# Check migration status
docker exec cgbas-mysql mysql -u root -p${DB_PASSWORD} cgbas_db -e "SELECT * FROM migrations;"

# Backup database
docker exec cgbas-mysql mysqldump -u root -p${DB_PASSWORD} cgbas_db > backup.sql

# Restore database
docker exec -i cgbas-mysql mysql -u root -p${DB_PASSWORD} cgbas_db < backup.sql

# Access MySQL CLI
docker exec -it cgbas-mysql mysql -u root -p${DB_PASSWORD} cgbas_db
```

### Docker Commands
```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build cgbas-ntrip

# Start all services
docker-compose up -d

# View running containers
docker-compose ps

# View logs
docker-compose logs -f cgbas-ntrip

# Restart service
docker-compose restart cgbas-ntrip

# Stop all
docker-compose down

# Rebuild và restart (sau khi sửa code)
docker-compose build cgbas-ntrip && docker-compose up -d cgbas-ntrip
```

### Testing
```bash
# Manual eWelink test
docker exec cgbas-app node test-ewelink.js

# Stress test recovery
docker exec cgbas-app node scripts/stress-recovery-concurrency.js
```

### Exec vào container
```bash
# Vào Node.js container
docker exec -it cgbas-app sh

# Vào MySQL container
docker exec -it cgbas-mysql sh

# Vào Go service container
docker exec -it cgbas-ntrip sh
```

## Common Workflows

### Adding New Migration
1. Create file: `src/migrations/NNN_description.sql`
2. Run: `docker exec cgbas-app node src/migrations/index.js`
3. Verify: `docker exec cgbas-mysql mysql -u root -p cgbas_db -e "SELECT * FROM migrations ORDER BY filename DESC LIMIT 1;"`

### Adding New API Endpoint
1. Create/update route file: `src/routes/xxxRoutes.js`
2. Add business logic in service/repository
3. Mount route in `src/main.js`
4. Restart: `docker-compose restart cgbas-app`
5. Test with curl/postman

### Adding New Frontend Page
1. Create partial: `public/partials/xxx.html`
2. Create JS: `public/js/xxx.js`
3. Create CSS: `public/css/xxx.css`
4. Add route in `public/js/router.js`
5. Add menu item in sidebar
6. Verify qua browser: http://localhost:3000

### Debugging
```bash
# Check Node.js logs
docker exec cgbas-app tail -f logs/app-$(date +%Y-%m-%d).log

# Check error logs
docker exec cgbas-app tail -f logs/error-$(date +%Y-%m-%d).log

# Check station status
docker exec cgbas-mysql mysql -u root -p cgbas_db -e "
  SELECT s.id, s.stationName, d.connectStatus, d.delay 
  FROM stations s 
  LEFT JOIN station_dynamic_info d ON s.id = d.stationId 
  WHERE s.is_active = 1;
"

# Check NTRIP service logs
docker-compose logs -f cgbas-ntrip | grep "connectStatus"
```

## Deployment Commands

### VPS Deployment
```bash
# Initial setup
docker exec cgbas-app bash setup-vps.sh

# Update deployment
docker exec cgbas-app bash update-vps.sh

# Check services
docker-compose ps

# View running logs
docker-compose logs -f --tail=100
```

### Production Commands
```bash
# Build for production
docker-compose --profile prod build

# Start production
docker-compose --profile prod up -d

# Check health
curl http://localhost:3000/health

# Check NTRIP service
curl http://localhost:8080/health
```

## Troubleshooting

### Common Issues

**MySQL Connection Refused**
```bash
# Check if MySQL is running
docker-compose ps cgbas-mysql

# Check MySQL logs
docker-compose logs cgbas-mysql

# Restart MySQL
docker-compose restart cgbas-mysql
```

**Migration Failed**
```bash
# Check migration status
docker exec cgbas-mysql mysql -u root -p cgbas_db -e "SELECT * FROM migrations;"

# Manually run migration
docker exec -i cgbas-mysql mysql -u root -p cgbas_db < src/migrations/NNN_description.sql
```

**NTRIP Connection Failed**
```bash
# Check Go service logs
docker-compose logs cgbas-ntrip

# Verify NTRIP config
docker exec cgbas-mysql mysql -u root -p cgbas_db -e "SELECT * FROM ntrip_config;"

# Test NTRIP connectivity
docker exec cgbas-ntrip wget -q -O- http://caster-url:port/mountpoint
```

**Recovery Not Working**
```bash
# Check recovery jobs
docker exec cgbas-mysql mysql -u root -p cgbas_db -e "
  SELECT * FROM station_recovery_jobs WHERE status = 'PENDING';
"

# Check offline stations
docker exec cgbas-mysql mysql -u root -p cgbas_db -e "
  SELECT stationId, connectStatus, offline_duration_seconds 
  FROM station_dynamic_info 
  WHERE connectStatus IN (2, 3);
"
```

## Useful SQL Queries

```sql
-- List all stations with status
SELECT s.id, s.stationName, s.status_source, d.connectStatus, d.delay
FROM stations s
LEFT JOIN station_dynamic_info d ON s.id = d.stationId
WHERE s.is_active = 1;

-- List NTRIP stations
SELECT s.id, s.stationName, c.ntrip_url, c.mountpoint
FROM stations s
JOIN ntrip_config c ON s.id = c.station_id
WHERE s.status_source = 'ntrip';

-- Check recovery jobs
SELECT * FROM station_recovery_jobs
WHERE status IN ('PENDING', 'RUNNING')
ORDER BY created_at DESC;

-- Recent NTRIP events
SELECT * FROM ntrip_logs
WHERE created_at > NOW() - INTERVAL 1 HOUR
ORDER BY created_at DESC;

-- Check container health
docker-compose ps
docker-compose logs --tail=50 cgbas-ntrip
```
