#!/bin/bash

# Quick start script for Docker

echo "🐳 CGBAS Docker Quick Start"
echo "============================"
echo ""
echo "Chọn môi trường:"
echo "1) Development (hot reload, debug)"
echo "2) Production (optimized, resource limited)"
echo "3) Stop tất cả"
echo ""
read -p "Lựa chọn (1-3): " choice

case $choice in
    1)
        echo "🚀 Starting Development environment..."
        docker-compose --profile dev up -d
        echo "✅ Dev server running at http://localhost:3000"
        echo "📝 Xem logs: docker-compose logs -f app-dev"
        ;;
    2)
        echo "🚀 Starting Production environment..."
        docker-compose --profile prod up -d --build
        echo "✅ Production server running at http://localhost:3000"
        echo "📝 Xem logs: docker-compose logs -f app-prod"
        ;;
    3)
        echo "🛑 Stopping all services..."
        docker-compose --profile dev --profile prod down
        echo "✅ All services stopped"
        ;;
    *)
        echo "❌ Lựa chọn không hợp lệ"
        exit 1
        ;;
esac
