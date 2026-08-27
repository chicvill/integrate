@echo off
echo ========================================================
echo   StudyCafe & SelfStudy Joint Stack Auto-Deploy Process
echo ========================================================

powershell -ExecutionPolicy Bypass -File "%~dp0deploy_local.ps1"
exit /b %ERRORLEVEL%
