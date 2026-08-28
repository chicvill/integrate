@echo off
chcp 65001 > nul
echo ========================================================
echo   Starting MQnet Media & File Management Ecosystem
echo   (Immich AI Smart Gallery: 9006, FileBrowser: 9007)
echo ========================================================

docker info >nul 2>&1
if %errorlevel% equ 0 goto docker_ready

echo [Docker Check] Docker Desktop is not running. Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo [Docker Check] Waiting for Docker daemon to initialize...

:wait_docker
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if %errorlevel% neq 0 goto wait_docker

:docker_ready
echo [Docker Check] Docker daemon is ready!

:: 1. Start Immich AI Full-Stack (Port 9006)
echo [Service 1/2] Starting Immich AI Full-Stack (Port 9006)...
if exist "%~dp0immich\docker-compose.yml" (
    docker compose -f "%~dp0immich\docker-compose.yml" up -d
)

:: 2. Start FileBrowser (Port 9007)
echo [Service 2/2] Starting FileBrowser (Port 9007)...
if exist "%~dp0filebrowser\docker-compose.yml" (
    docker compose -f "%~dp0filebrowser\docker-compose.yml" up -d
)

echo.
echo ========================================================
echo   Media & File Services Ready
echo ========================================================
echo 1. Immich AI Smart Gallery : http://localhost:9006
echo 2. FileBrowser (All Files) : http://localhost:9007
echo ========================================================
echo.
docker ps --filter "name=immich" --filter "name=filebrowser" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.
pause
