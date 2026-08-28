@echo off
title NH농협 입금 실시간 수신 모니터 서버
cd /d "%~dp0"

echo ====================================================
echo  NH농협 계좌 입금 실시간 알림 대시보드 서버를 시작합니다.
echo ====================================================
echo.

IF NOT EXIST node_modules (
    echo [안내] 최초 실행: 필요한 패키지를 설치합니다...
    call npm install
    echo.
)

echo [안내] 웹 브라우저(http://localhost:3000)를 자동으로 열고 서버를 실행합니다...
start http://localhost:3000

echo [안내] 서버가 구동 중입니다. 이 창을 닫지 마세요.
echo ====================================================
echo.

npm start
pause
