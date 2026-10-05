@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 > nul
title MQnet Integrated Platform Launcher

REM ============================================================
REM  MQnet Multi-SaaS Integrated Platform - Launch Script
REM
REM  Usage:
REM    run.bat           -> gateway mode (port 9000 / 10000, default)
REM    run.bat gateway   -> gateway mode (port 9000 / 10000)
REM    run.bat all       -> launch all apps in separate windows
REM    run.bat docker    -> launch via Docker Compose
REM    run.bat install   -> install packages only
REM
REM  9000 Series Port Mapping:
REM    Port 9000 - Gateway & All-in-One Dashboard (also 10000)
REM    Port 9001 - MQnet Brand Homepage
REM    Port 9002 - StudyCafe Management
REM    Port 9003 - SelfStudy Planner
REM    Port 9004 - Store POS & Management
REM    Port 9005 - SmartFarm IoT Monitoring
REM    Port 9006 - Immich AI Smart Gallery
REM    Port 9007 - FileBrowser All-Files Manager
REM    Port 9008 - YouTube Media Downloader
REM    Port 9009 - AI Gwansang (Face Reading)
REM    Port 9010 - Teto vs Egen Face Analyzer
REM    Port 9011 - Ironman Gesture Game
REM    Port 9012 - Modern Smart Clock
REM    Port 9013 - Retro TV VideoBooth
REM ============================================================

set "BASE=%~dp0"
set "MODE=%~1"
if "%MODE%"=="" set "MODE=gateway"

echo.
echo ======================================================
echo    MQnet 14 Multi-SaaS Integrated Platform
echo    Unified Port Layout: 9000 ~ 9013
echo ======================================================
echo.

REM --- Check .env.shared ---
if not exist "%BASE%.env.shared" (
    echo [ERROR] .env.shared file not found.
    echo         Please copy .env.shared.template to .env.shared
    echo.
    pause
    exit /b 1
)
echo [OK] .env.shared found

REM --- Check Python ---
python --version > nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('python --version 2^>^&1') do echo [OK] %%v

REM --- Check and Start Docker Desktop ---
docker info >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        echo [Docker Check] Docker Desktop is not running. Starting Docker Desktop in background...
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    )
) else (
    echo [OK] Docker Desktop is already running
)

REM --- Route by MODE ---
if /i "%MODE%"=="install" goto do_install
if /i "%MODE%"=="gateway" goto do_gateway
if /i "%MODE%"=="all" goto do_all
if /i "%MODE%"=="docker" goto do_docker
if /i "%MODE%"=="backup" goto do_backup

echo [ERROR] Unknown option: %MODE%
echo.
echo Usage:
echo   run.bat           - gateway mode (port 9000, default)
echo   run.bat gateway   - gateway mode (port 9000)
echo   run.bat all       - launch apps in separate windows
echo   run.bat docker    - run with Docker Compose (port 9000 & 10000)
echo   run.bat backup    - run one-click data backup
echo   run.bat install   - install packages only

echo.
pause
exit /b 1

REM ================================================================
REM  BACKUP mode
REM ================================================================
:do_backup
call "%BASE%scripts\backup_all.bat"
exit /b 0


REM ================================================================
REM  INSTALL mode
REM ================================================================
:do_install
echo.
echo [INSTALL] Running: pip install -r requirements.txt
echo.
pip install -r "%BASE%requirements.txt"
if errorlevel 1 (
    echo [ERROR] Package installation failed.
    pause
    exit /b 1
)
echo.
echo [DONE] All packages installed successfully.
pause
exit /b 0


REM ================================================================
REM  GATEWAY mode: single server on port 9000 & 10000 (default)
REM ================================================================
:do_gateway
echo.
echo [MODE] GATEWAY - Single server, all apps unified on port 9000 (and 10000)
echo.
echo   Access URLs:
echo     Main Portal: http://localhost:9000  (or http://localhost:10000)
echo     API Docs:    http://localhost:9000/docs
echo     App List:    http://localhost:9000/apps
echo     Health:      http://localhost:9000/health
echo.
echo [START] Starting gateway... (Press Ctrl+C to stop)
echo --------------------------------------------------------
echo.

cd /d "%BASE%"
set "PYTHONPATH=%BASE%"
python -m uvicorn gateway.main:app --host 0.0.0.0 --port 9000 --reload --reload-dir "%BASE%shared" --reload-dir "%BASE%apps" --reload-dir "%BASE%gateway"
if errorlevel 1 (
    echo.
    echo [ERROR] Gateway stopped unexpectedly.
    pause
)
exit /b 0


REM ================================================================
REM  ALL mode: launch gateway + each app in separate windows
REM ================================================================
:do_all
echo.
echo [MODE] ALL - Launching gateway + all apps in separate windows (9000 Series)
echo.
echo   Services to start:
echo     Port 9000 - Gateway (unified API)
echo     Port 9002 - StudyCafe
echo     Port 9003 - SelfStudy
echo     Port 9004 - Store POS
echo     Port 9005 - SmartFarm
echo     Port 9009 - AI Gwansang
echo.

set "PYTHONPATH=%BASE%"
cd /d "%BASE%"

REM Gateway (port 9000)
start "MQnet-Gateway [9000]" cmd /k "title MQnet-Gateway [9000] && color 0A && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet Gateway - Port 9000 === && python -m uvicorn gateway.main:app --host 0.0.0.0 --port 9000 --reload"

timeout /t 2 /nobreak > nul

REM StudyCafe (port 9002)
start "MQnet-StudyCafe [9002]" cmd /k "title MQnet-StudyCafe [9002] && color 0B && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet StudyCafe - Port 9002 === && python -m uvicorn apps.studycafe.backend.main:app --host 0.0.0.0 --port 9002 --reload"

timeout /t 1 /nobreak > nul

REM SelfStudy (port 9003)
start "MQnet-SelfStudy [9003]" cmd /k "title MQnet-SelfStudy [9003] && color 0D && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet SelfStudy - Port 9003 === && python -m uvicorn apps.selfstudy.backend.main:app --host 0.0.0.0 --port 9003 --reload"

timeout /t 1 /nobreak > nul

REM Store (port 9004)
start "MQnet-Store [9004]" cmd /k "title MQnet-Store [9004] && color 0C && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet Store - Port 9004 === && python -m uvicorn apps.store.backend.main:app --host 0.0.0.0 --port 9004 --reload"

timeout /t 1 /nobreak > nul

REM SmartFarm (port 9005)
start "MQnet-SmartFarm [9005]" cmd /k "title MQnet-SmartFarm [9005] && color 0E && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet SmartFarm - Port 9005 === && python -m uvicorn apps.smartfarm.backend.main:app --host 0.0.0.0 --port 9005 --reload"

timeout /t 1 /nobreak > nul

REM AI Gwansang (port 9009)
start "MQnet-AI-Gwansang [9009]" cmd /k "title MQnet-AI-Gwansang [9009] && color 09 && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet AI-Gwansang - Port 9009 === && python -m uvicorn apps.ai_gwansang.backend.main:app --host 0.0.0.0 --port 9009 --reload"

timeout /t 1 /nobreak > nul

REM n8n Deposit Alert (port 3000)
if exist "%BASE%apps\n8n\index.js" (
    start "MQnet-n8n-Deposit [3000]" cmd /k "title MQnet-n8n-Deposit [3000] && color 0A && cd /d %BASE%apps\n8n && echo === MQnet NH Deposit Alert - Port 3000 === && node index.js"
)

echo.
echo [DONE] Server windows launched.
echo.
echo   Close each window or press Ctrl+C in each window to stop.
echo.
pause
exit /b 0

REM ============================================================
REM  MODE: docker
REM ============================================================
:do_docker
echo.
echo === Starting MQnet via Docker Compose (9000 Series) ===
docker compose up -d
echo.
echo [DONE] Docker containers started.
echo   - Portal: http://localhost:9000/ (or http://localhost:10000/)
echo   - Docs:   http://localhost:9000/docs
echo.
echo Use "docker compose logs -f" to view logs.
echo Use "docker compose down" to stop containers.
echo.
pause
exit /b 0