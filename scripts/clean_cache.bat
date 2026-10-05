@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 > nul
title MQnet Integrated Platform Cache Cleaner

echo ========================================================
echo   MQnet Integrated Platform - System Cache Cleaner
echo ========================================================
echo.

set "BASE=%~dp0..\"
cd /d "%BASE%"

echo [1/4] Cleaning Python __pycache__ directories...
for /d /r . %%d in (__pycache__) do (
    if exist "%%d" (
        rmdir /s /q "%%d" > nul 2>&1
    )
)
echo   - Cleaned all __pycache__ folders.

echo.
echo [2/4] Cleaning Python .pyc and temporary journal files...
del /s /q /f *.pyc > nul 2>&1
del /s /q /f *.pyo > nul 2>&1
del /s /q /f *.pyd > nul 2>&1
del /s /q /f *.sqlite-wal > nul 2>&1
del /s /q /f *.sqlite-shm > nul 2>&1
echo   - Cleaned temporary runtime bytecodes and journals.

echo.
echo [3/4] Cleaning Unity and Node build cache leftovers...
if exist "%BASE%apps\Clock\Library" (
    rmdir /s /q "%BASE%apps\Clock\Library" > nul 2>&1
    echo   - Cleaned apps\Clock\Library cache.
)
if exist "%BASE%apps\Clock\Logs" (
    rmdir /s /q "%BASE%apps\Clock\Logs" > nul 2>&1
)
if exist "%BASE%apps\Clock\obj" (
    rmdir /s /q "%BASE%apps\Clock\obj" > nul 2>&1
)
if exist "%BASE%apps\Clock\UserSettings" (
    rmdir /s /q "%BASE%apps\Clock\UserSettings" > nul 2>&1
)
if exist "%BASE%apps\Clock\temp.dds" (
    del /f /q "%BASE%apps\Clock\temp.dds" > nul 2>&1
    echo   - Cleaned apps\Clock\temp.dds.
)

echo.
echo [4/4] Cache cleanup completed!
echo ========================================================
echo.
pause
