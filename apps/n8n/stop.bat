@echo off
title NH농협 입금 알림 서버 종료
cd /d "%~dp0"

echo ====================================================
echo  NH농협 계좌 입금 알림 서버(Node.js)를 종료합니다.
echo ====================================================
echo.

taskkill /F /IM node.exe > nul 2>&1

echo [완료] 구동 중인 Node.js 서버 프로세스가 모두 안전하게 종료되었습니다.
echo.
pause
