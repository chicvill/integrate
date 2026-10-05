@echo off
title Iron Man Game Server
chcp 65001 >nul

echo ========================================================
echo  Iron Man Game Web Server Start
echo  http://localhost:8000
echo  Exit: Press Ctrl+C in this window
echo ========================================================
echo.

start "" "http://localhost:8000"

python -m http.server 8000
