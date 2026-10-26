@echo off
echo ========================================================
echo   SelfStudy Local Runner Auto-Deploy Process
echo ========================================================

powershell -ExecutionPolicy Bypass -File "%~dp0deploy_local.ps1"
exit /b %ERRORLEVEL%



