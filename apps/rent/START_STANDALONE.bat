@echo off
chcp 65001 > nul
title 원룸 임대관리 솔루션 실행기 (Standalone)
echo ========================================================
echo  🏢 부동산 원룸 임차료 관리 시스템 (Standalone Mode)
echo ========================================================
echo.

where docker >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [1/2] Docker 감지됨: Docker Compose로 컨테이너를 가동합니다...
    docker compose -f docker-compose.standalone.yml up -d --build
    if %ERRORLEVEL% equ 0 (
        echo.
        echo [2/2] 가동 완료! 웹 브라우저를 오픈합니다.
        timeout /t 2 >nul
        start http://localhost
        echo.
        echo 접속 주소: http://localhost (또는 사내 IP: http://^<PC-IP^>)
        echo 종료 명령: docker compose -f docker-compose.standalone.yml down
        goto :END
    )
)

echo [1/2] Docker 미설치 환경: 로컬 Python 환경으로 직접 구동합니다...
start http://localhost:8000
py standalone_runner.py

:END
pause
