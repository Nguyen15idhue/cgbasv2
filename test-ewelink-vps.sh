#!/bin/bash
# Script test eWeLink API trên VPS
# Usage: ./test-ewelink-vps.sh [test|refresh|control]

echo "🔧 eWeLink Test Script for VPS"
echo ""

CONTAINER_NAME="cgbas-app-prod"
TEST_FILE="test-ewelink.js"

# Kiểm tra container có đang chạy không
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ Container $CONTAINER_NAME không chạy!"
    echo "   Hãy start container trước: docker-compose --profile prod up -d"
    exit 1
fi

# Copy file test vào container (nếu chưa có hoặc đã update)
if [ -f "$TEST_FILE" ]; then
    echo "📤 Copy file test vào container..."
    docker cp $TEST_FILE $CONTAINER_NAME:/app/$TEST_FILE
    echo "✅ Đã copy xong!"
    echo ""
else
    echo "⚠️  Không tìm thấy file $TEST_FILE"
    echo "   Hãy pull code mới: git pull origin main"
    exit 1
fi

# Chạy test theo tham số
if [ "$1" == "refresh" ]; then
    echo "🔄 Đang refresh token..."
    docker exec -it $CONTAINER_NAME node $TEST_FILE refresh

elif [ "$1" == "control" ]; then
    if [ -z "$2" ]; then
        echo "❌ Thiếu device ID!"
        echo "   Usage: ./test-ewelink-vps.sh control <device-id> [channel] [action]"
        echo "   Ví dụ: ./test-ewelink-vps.sh control 1000abc123 0 on"
        exit 1
    fi
    
    DEVICE_ID="$2"
    CHANNEL="${3:-0}"
    ACTION="${4:-on}"
    
    echo "🎮 Điều khiển thiết bị $DEVICE_ID..."
    docker exec -it $CONTAINER_NAME node $TEST_FILE control $DEVICE_ID $CHANNEL $ACTION

elif [ "$1" == "logs" ]; then
    echo "📋 Xem API logs gần đây..."
    docker exec -it $CONTAINER_NAME sh -c "tail -100 logs/app.log | grep -i ewelink"

else
    echo "🧪 Chạy tất cả các test..."
    docker exec -it $CONTAINER_NAME node $TEST_FILE
fi

echo ""
echo "✅ Hoàn thành!"
