@echo off
chcp 65001 > nul
echo ========================================================
echo   Starting MQnet Photos Microservice (photos.chicvill.store)
echo ========================================================

docker info >nul 2>&1
if %errorlevel% equ 0 goto docker_ready

echo [Docker Check] Docker Desktop is not running. Starting Docker Desktop...
start "" "C:\Users\user\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
echo [Docker Check] Waiting for Docker daemon to initialize...

:wait_docker
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if %errorlevel% neq 0 goto wait_docker

:docker_ready
echo [Docker Check] Docker daemon is ready!

echo [Clean Check] Cleaning existing photos containers...
docker rm -f mqnet-photos mqnet-cloudflared-photos >nul 2>&1

if exist "%~dp0..\.env" (
    echo [Auto Sync .env] Copying root .env to photos folder...
    copy /Y "%~dp0..\.env" "%~dp0.env" >nul 2>&1
)

echo.
echo Photos Backend     -> http://localhost:8006
echo Cloudflare Tunnel -> https://photos.chicvill.store
echo ========================================================
echo.
docker compose up -d --build
echo.
echo Container Status:
docker compose ps
echo.
pause
