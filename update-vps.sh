#!/bin/bash

# Quick update script for CGBAS on VPS (with NTRIP support)

set -e

echo "🔄 Updating CGBAS..."

cd /opt/cgbasv2

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Backup database (skip if container not running)
echo "💾 Creating backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/backups

if docker ps --format '{{.Names}}' | grep -q "^cgbas-mysql$"; then
    docker exec cgbas-mysql mysqldump --no-tablespaces -u root -p$(grep DB_PASS .env | cut -d '=' -f2) cgbas_db > ~/backups/cgbas_pre_update_$TIMESTAMP.sql
    gzip ~/backups/cgbas_pre_update_$TIMESTAMP.sql
    echo "✅ Backup saved: ~/backups/cgbas_pre_update_$TIMESTAMP.sql.gz"
else
    echo "⚠️  Container cgbas-mysql not running, skipping backup..."
fi

# Stop containers (if running)
echo "🛑 Stopping containers..."
docker-compose --profile prod down 2>/dev/null || true

# Rebuild ALL services
echo "🔨 Rebuilding images (app-prod + ntrip-prod)..."
docker-compose build --no-cache app-prod ntrip-prod

# Start containers
echo "🚀 Starting containers..."
docker-compose --profile prod up -d

# Wait for health check
echo "⏳ Waiting for application to be healthy..."
sleep 10

# Run pending migrations (if any new .sql files)
echo "📦 Checking for new migrations..."
MIGRATION_FILES=$(ls -1 src/migrations/*.sql 2>/dev/null | wc -l)
echo "   Found $MIGRATION_FILES migration files"

# Check health
echo ""
echo "🔍 Health checks:"
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "   ✅ App (port 3001): OK"
else
    echo "   ⚠️  App (port 3001): FAILED"
fi

if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo "   ✅ NTRIP (port 8080): OK"
else
    echo "   ⚠️  NTRIP (port 8080): FAILED"
fi

# Show container status
echo ""
echo "📊 Container status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep cgbas

# Show recent logs
echo ""
echo "📋 Recent logs (app):"
docker-compose logs --tail=5 app-prod

echo ""
echo "📋 Recent logs (ntrip):"
docker-compose logs --tail=5 ntrip-prod

echo ""
echo "✨ Update complete!"
echo ""
echo "Useful commands:"
echo "   docker-compose logs -f app-prod      # App logs"
echo "   docker-compose logs -f ntrip-prod    # NTRIP logs"
echo "   docker-compose ps                     # Container status"
