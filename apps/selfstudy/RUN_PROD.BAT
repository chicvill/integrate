@echo off
chcp 65001 > nul
echo ========================================================
echo   SelfStudy & StudyCafe Joint Production Launcher
echo ========================================================
echo.
if exist "%~dp0..\.env" (
    echo [Auto Sync .env] Copying root MQnet/.env to selfstudy/.env...
    copy /Y "%~dp0..\.env" "%~dp0.env" > nul
)
echo Starting SelfStudy (http://localhost:8005) and StudyCafe (http://localhost:8001)...
cd /d "%~dp0"

docker compose up -d --build
echo.
echo Container Status:
docker compose ps
echo.
pause
