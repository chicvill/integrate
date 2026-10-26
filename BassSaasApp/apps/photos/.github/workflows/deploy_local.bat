@echo off
echo ========================================================
echo   MQnet Photos Microservice Auto-Deploy Process
echo ========================================================

powershell -ExecutionPolicy Bypass -File "%~dp0deploy_local.ps1"
exit /b %ERRORLEVEL%
