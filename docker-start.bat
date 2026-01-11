@echo off
REM Quick start script for Docker on Windows

echo.
echo 🐳 CGBAS Docker Quick Start
echo ============================
echo.
echo Chon moi truong:
echo 1) Development (hot reload, debug)
echo 2) Production (optimized, resource limited)
echo 3) Stop tat ca
echo.

set /p choice="Lua chon (1-3): "

if "%choice%"=="1" (
    echo.
    echo 🚀 Starting Development environment...
    docker-compose --profile dev up -d
    echo.
    echo ✅ Dev server running at http://localhost:3000
    echo 📝 Xem logs: docker-compose logs -f app-dev
    pause
) else if "%choice%"=="2" (
    echo.
    echo 🚀 Starting Production environment...
    docker-compose --profile prod up -d --build
    echo.
    echo ✅ Production server running at http://localhost:3000
    echo 📝 Xem logs: docker-compose logs -f app-prod
    pause
) else if "%choice%"=="3" (
    echo.
    echo 🛑 Stopping all services...
    docker-compose --profile dev --profile prod down
    echo.
    echo ✅ All services stopped
    pause
) else (
    echo.
    echo ❌ Lua chon khong hop le
    pause
    exit /b 1
)
