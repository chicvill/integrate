@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 > nul
title MQnet Integrated Platform Backup Utility

echo ========================================================
echo   MQnet Integrated Platform - One-Click Backup Utility
echo ========================================================
echo.

set "BASE=%~dp0..\"
cd /d "%BASE%"

:: Create Timestamped Backup Folder
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "dt=%%I"
set "TIMESTAMP=%dt:~0,4%%dt:~4,2%%dt:~6,2%_%dt:~8,2%%dt:~10,2%%dt:~12,2%"
set "BACKUP_DIR=%BASE%backups\backup_%TIMESTAMP%"

if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
)

echo [1/4] Backing up SQLite Databases...
if exist "%BASE%integrat.db" (
    copy /y "%BASE%integrat.db" "%BACKUP_DIR%\integrat.db" > nul
    echo   - integrat.db copied.
)
if exist "D:\Workstation\Test-n8n\database.sqlite" (
    copy /y "D:\Workstation\Test-n8n\database.sqlite" "%BACKUP_DIR%\n8n_database.sqlite" > nul
    echo   - n8n_database.sqlite copied.
)

echo.
echo [2/4] Backing up Environment and Configurations...
if exist "%BASE%.env.shared" (
    copy /y "%BASE%.env.shared" "%BACKUP_DIR%\.env.shared" > nul
    echo   - .env.shared copied.
)
if exist "%BASE%apps\photos\immich\.env" (
    copy /y "%BASE%apps\photos\immich\.env" "%BACKUP_DIR%\immich.env" > nul
    echo   - immich.env copied.
)

echo.
echo [3/4] Backing up n8n Workflows...
if exist "%BASE%apps\n8n\workflows" (
    mkdir "%BACKUP_DIR%\workflows" > nul 2>&1
    copy /y "%BASE%apps\n8n\workflows\*.json" "%BACKUP_DIR%\workflows\" > nul
    echo   - n8n workflow templates copied.
)

echo.
echo [4/4] Writing Backup Manifest...
echo Backup Date: %date% %time% > "%BACKUP_DIR%\manifest.txt"
echo Source: %BASE% >> "%BACKUP_DIR%\manifest.txt"
echo Backup Folder: %BACKUP_DIR% >> "%BACKUP_DIR%\manifest.txt"

echo.
echo ========================================================
echo   [SUCCESS] Backup completed successfully!
echo   Location: %BACKUP_DIR%
echo ========================================================
echo.
pause
