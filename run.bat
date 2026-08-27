@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 > nul
title MQnet Integrated Platform Launcher

REM ============================================================
REM  MQnet Multi-SaaS Integrated Platform - Launch Script
REM
REM  Usage:
REM    run.bat           -> gateway mode (port 10000, default)
REM    run.bat gateway   -> gateway mode (port 10000)
REM    run.bat all       -> launch all apps in separate windows
REM    run.bat install   -> install packages only
REM
REM  Apps included:
REM    Port 10000 - Gateway (all apps unified)
REM    Port  8001 - StudyCafe Management
REM    Port  8002 - Store QR Order
REM    Port  8003 - SelfStudy Learning
REM    Port  8004 - SmartFarm IoT
REM    Port  8005 - AI Gwansang (Face Reading)
REM ============================================================

set "BASE=%~dp0"
set "MODE=%~1"
if "%MODE%"=="" set "MODE=gateway"

echo.
echo ======================================================
echo    MQnet Multi-SaaS Integrated Platform
echo    studycafe / store / selfstudy / smartfarm / gwansang
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

REM --- Route by MODE ---
if /i "%MODE%"=="install" goto do_install
if /i "%MODE%"=="gateway" goto do_gateway
if /i "%MODE%"=="all" goto do_all
if /i "%MODE%"=="docker" goto do_docker

echo [ERROR] Unknown option: %MODE%
echo.
echo Usage:
echo   run.bat           - gateway mode (port 10000, default)
echo   run.bat gateway   - gateway mode (port 10000)
echo   run.bat all       - launch all apps in separate windows
echo   run.bat docker    - run with Docker Compose (port 10000)
echo   run.bat install   - install packages only

echo.
pause
exit /b 1


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
REM  GATEWAY mode: single server on port 10000 (default)
REM ================================================================
:do_gateway
echo.
echo [MODE] GATEWAY - Single server, all apps unified on port 10000
echo.
echo   Access URLs:
echo     Main:      http://localhost:10000
echo     API Docs:  http://localhost:10000/docs
echo     App List:  http://localhost:10000/apps
echo     Health:    http://localhost:10000/health
echo.
echo   Per-app API (via gateway):
echo     StudyCafe: http://localhost:10000/api/studycafe/
echo     Store:     http://localhost:10000/api/store/
echo     SelfStudy: http://localhost:10000/api/selfstudy/
echo     SmartFarm: http://localhost:10000/api/smartfarm/
echo     Gwansang:  http://localhost:10000/api/ai_gwansang/
echo.
echo [START] Starting gateway... (Press Ctrl+C to stop)
echo --------------------------------------------------------
echo.

cd /d "%BASE%"
set "PYTHONPATH=%BASE%"
python -m uvicorn gateway.main:app --host 0.0.0.0 --port 10000 --reload --reload-dir "%BASE%shared" --reload-dir "%BASE%apps" --reload-dir "%BASE%gateway"
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
echo [MODE] ALL - Launching gateway + all apps in separate windows
echo.
echo   Services to start:
echo     Port 10000 - Gateway (unified API)
echo     Port  8001 - StudyCafe
echo     Port  8002 - Store QR Order
echo     Port  8003 - SelfStudy
echo     Port  8004 - SmartFarm
echo     Port  8005 - AI Gwansang
echo.

set "PYTHONPATH=%BASE%"
cd /d "%BASE%"

REM Gateway (port 10000)
start "MQnet-Gateway [10000]" cmd /k "title MQnet-Gateway [10000] && color 0A && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet Gateway - Port 10000 === && python -m uvicorn gateway.main:app --host 0.0.0.0 --port 10000 --reload"

timeout /t 2 /nobreak > nul

REM StudyCafe (port 8001)
start "MQnet-StudyCafe [8001]" cmd /k "title MQnet-StudyCafe [8001] && color 0B && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet StudyCafe - Port 8001 === && python -m uvicorn apps.studycafe.backend.main:app --host 0.0.0.0 --port 8001 --reload"

timeout /t 1 /nobreak > nul

REM Store (port 8002)
start "MQnet-Store [8002]" cmd /k "title MQnet-Store [8002] && color 0C && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet Store - Port 8002 === && python -m uvicorn apps.store.backend.main:app --host 0.0.0.0 --port 8002 --reload"

timeout /t 1 /nobreak > nul

REM SelfStudy (port 8003)
start "MQnet-SelfStudy [8003]" cmd /k "title MQnet-SelfStudy [8003] && color 0D && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet SelfStudy - Port 8003 === && python -m uvicorn apps.selfstudy.backend.main:app --host 0.0.0.0 --port 8003 --reload"

timeout /t 1 /nobreak > nul

REM SmartFarm (port 8004)
start "MQnet-SmartFarm [8004]" cmd /k "title MQnet-SmartFarm [8004] && color 0E && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet SmartFarm - Port 8004 === && python -m uvicorn apps.smartfarm.backend.main:app --host 0.0.0.0 --port 8004 --reload"

timeout /t 1 /nobreak > nul

REM AI Gwansang (port 8005)
start "MQnet-AI-Gwansang [8005]" cmd /k "title MQnet-AI-Gwansang [8005] && color 09 && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet AI-Gwansang - Port 8005 === && python -m uvicorn apps.ai_gwansang.backend.main:app --host 0.0.0.0 --port 8005 --reload"

timeout /t 1 /nobreak > nul

REM Photos & Media Gallery (port 8006)
start "MQnet-Photos [8006]" cmd /k "title MQnet-Photos [8006] && color 0D && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet Photos - Port 8006 === && python -m uvicorn apps.photos.backend.main:app --host 0.0.0.0 --port 8006 --reload"

echo.
echo [DONE] 7 server windows launched.
echo.
echo   API Docs:
echo     Gateway:   http://localhost:10000/docs
echo     StudyCafe: http://localhost:8001/docs
echo     Store:     http://localhost:8002/docs
echo     SelfStudy: http://localhost:8003/docs
echo     SmartFarm: http://localhost:8004/docs
echo     Gwansang:  http://localhost:8005/docs
echo     Photos:    http://localhost:8006/docs
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
echo === Starting MQnet via Docker Compose ===
docker compose up -d
echo.
echo [DONE] Docker containers started.
echo   - Portal: http://localhost:10000/
echo   - Docs:   http://localhost:10000/docs
echo.
echo Use "docker compose logs -f" to view logs.
echo Use "docker compose down" to stop containers.
echo.
pause
exit /b 0