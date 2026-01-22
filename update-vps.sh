#!/bin/bash

# Quick update script for CGBAS on VPS

set -e

echo "🔄 Updating CGBAS..."

cd /opt/cgbasv2

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Backup database
echo "💾 Creating backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/backups
docker exec cgbas-mysql mysqldump --no-tablespaces -u cgbas -p$(grep DB_PASS .env | cut -d '=' -f2) cgbas_db > ~/backups/cgbas_pre_update_$TIMESTAMP.sql
gzip ~/backups/cgbas_pre_update_$TIMESTAMP.sql
echo "✅ Backup saved: ~/backups/cgbas_pre_update_$TIMESTAMP.sql.gz"

# Stop containers
echo "🛑 Stopping containers..."
docker-compose --profile prod down

# Rebuild
echo "🔨 Rebuilding image..."
docker-compose build --no-cache app-prod

# Start containers
echo "🚀 Starting containers..."
docker-compose --profile prod up -d

# Wait for health check
echo "⏳ Waiting for application to be healthy..."
sleep 10

# Check health
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Update successful! Application is healthy."
else
    echo "⚠️  Warning: Health check failed. Check logs:"
    echo "   docker-compose logs -f app-prod"
fi

# Show logs
echo ""
echo "📋 Recent logs:"
docker-compose logs --tail=20 app-prod

echo ""
echo "✨ Update complete!"
echo "View full logs: docker-compose logs -f"
