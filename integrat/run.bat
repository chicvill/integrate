@echo off
chcp 65001 > nul
title MQnet Integrated Platform Launcher

:: ============================================================
::  MQnet Multi-SaaS Integrated Platform - Launch Script
::
::  Usage:
::    run.bat           -> gateway mode (port 10000, default)
::    run.bat gateway   -> gateway mode (port 10000)
::    run.bat all       -> launch all apps in separate windows
::    run.bat install   -> install packages only
::
::  Apps included:
::    Port 10000 - Gateway (all apps unified)
::    Port  8001 - StudyCafe Management
::    Port  8002 - Store QR Order
::    Port  8003 - SelfStudy Learning
::    Port  8004 - SmartFarm IoT
::    Port  8005 - AI Gwansang (Face Reading)
:: ============================================================

setlocal EnableDelayedExpansion

set "BASE=%~dp0"
set "MODE=%1"
if "%MODE%"=="" set "MODE=gateway"

echo.
echo ======================================================
echo    MQnet Multi-SaaS Integrated Platform
echo    studycafe / store / selfstudy / smartfarm / gwansang
echo ======================================================
echo.

:: --- Check .env.shared ------------------------------------------
if not exist "%BASE%.env.shared" (
    echo [ERROR] .env.shared file not found.
    echo         Please copy .env.shared.template to .env.shared
    echo.
    echo         copy .env.shared.template .env.shared
    echo.
    pause
    exit /b 1
)
echo [OK] .env.shared found

:: --- Check Python -----------------------------------------------
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo [OK] %%v

:: ================================================================
::  INSTALL mode: install packages only
:: ================================================================
if "%MODE%"=="install" (
    echo.
    echo [INSTALL] Running: pip install -r requirements.txt
    echo.
    pip install -r "%BASE%requirements.txt"
    if %errorlevel% neq 0 (
        echo [ERROR] Package installation failed.
        pause
        exit /b 1
    )
    echo.
    echo [DONE] All packages installed successfully.
    pause
    exit /b 0
)

:: --- Check uvicorn ----------------------------------------------
python -c "import uvicorn" > nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] uvicorn not found. Installing packages...
    pip install -r "%BASE%requirements.txt" -q
    if %errorlevel% neq 0 (
        echo [ERROR] Package installation failed.
        echo         Please run: pip install -r requirements.txt
        pause
        exit /b 1
    )
    echo [OK] Packages installed.
)

:: ================================================================
::  GATEWAY mode: single server on port 10000 (default)
:: ================================================================
if "%MODE%"=="gateway" (
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
    set PYTHONPATH=%BASE%
    python -m uvicorn gateway.main:app --host 0.0.0.0 --port 10000 --reload --reload-dir "%BASE%shared" --reload-dir "%BASE%apps" --reload-dir "%BASE%gateway"
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Gateway stopped unexpectedly.
        pause
    )
    goto :end
)

:: ================================================================
::  ALL mode: launch gateway + each app in separate windows
:: ================================================================
if "%MODE%"=="all" (
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

    set PYTHONPATH=%BASE%
    cd /d "%BASE%"

    :: Gateway (port 10000)
    start "MQnet-Gateway [10000]" cmd /k "title MQnet-Gateway [10000] && color 0A && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet Gateway - Port 10000 === && python -m uvicorn gateway.main:app --host 0.0.0.0 --port 10000 --reload"

    timeout /t 2 /nobreak > nul

    :: StudyCafe (port 8001)
    start "MQnet-StudyCafe [8001]" cmd /k "title MQnet-StudyCafe [8001] && color 0B && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet StudyCafe - Port 8001 === && python -m uvicorn apps.studycafe.backend.main:app --host 0.0.0.0 --port 8001 --reload"

    timeout /t 1 /nobreak > nul

    :: Store (port 8002)
    start "MQnet-Store [8002]" cmd /k "title MQnet-Store [8002] && color 0C && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet Store - Port 8002 === && python -m uvicorn apps.store.backend.main:app --host 0.0.0.0 --port 8002 --reload"

    timeout /t 1 /nobreak > nul

    :: SelfStudy (port 8003)
    start "MQnet-SelfStudy [8003]" cmd /k "title MQnet-SelfStudy [8003] && color 0D && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet SelfStudy - Port 8003 === && python -m uvicorn apps.selfstudy.backend.main:app --host 0.0.0.0 --port 8003 --reload"

    timeout /t 1 /nobreak > nul

    :: SmartFarm (port 8004)
    start "MQnet-SmartFarm [8004]" cmd /k "title MQnet-SmartFarm [8004] && color 0E && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet SmartFarm - Port 8004 === && python -m uvicorn apps.smartfarm.backend.main:app --host 0.0.0.0 --port 8004 --reload"

    timeout /t 1 /nobreak > nul

    :: AI Gwansang (port 8005)
    start "MQnet-AI-Gwansang [8005]" cmd /k "title MQnet-AI-Gwansang [8005] && color 09 && cd /d %BASE% && set PYTHONPATH=%BASE% && echo === MQnet AI-Gwansang - Port 8005 === && python -m uvicorn apps.ai_gwansang.backend.main:app --host 0.0.0.0 --port 8005 --reload"

    echo.
    echo [DONE] 6 server windows launched.
    echo.
    echo   API Docs:
    echo     Gateway:   http://localhost:10000/docs
    echo     StudyCafe: http://localhost:8001/docs
    echo     Store:     http://localhost:8002/docs
    echo     SelfStudy: http://localhost:8003/docs
    echo     SmartFarm: http://localhost:8004/docs
    echo     Gwansang:  http://localhost:8005/docs
    echo.
    echo   Close each window or press Ctrl+C in each window to stop.
    echo.
    pause
    goto :end
)

:: --- Unknown option ---------------------------------------------
echo [ERROR] Unknown option: %MODE%
echo.
echo Usage:
echo   run.bat           - gateway mode (port 10000, default)
echo   run.bat gateway   - gateway mode (port 10000)
echo   run.bat all       - launch all apps in separate windows
echo   run.bat install   - install packages only

:end
endlocal