@echo off
chcp 65001 > nul
echo ========================================================
echo   Setting up GitHub Actions Runner for Photos Microservice
echo ========================================================

powershell -ExecutionPolicy Bypass -File "%~dp0SETUP_GITHUB_RUNNER.ps1"
pause
