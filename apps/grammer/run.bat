@echo off
setlocal
cd /d "%~dp0"
title Grammar Quest TV Server

echo Starting Grammar Quest TV Server...
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

start http://localhost:3000
node server.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Server exited unexpectedly.
    pause
)
