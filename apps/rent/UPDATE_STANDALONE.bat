@echo off
chcp 65001 > nul
title 원룸 임대관리 솔루션 업데이트기 (Standalone)
echo ========================================================
echo  🔄 부동산 원룸 임차료 관리 시스템 최신 업데이트
echo ========================================================
echo.
echo [안내] 고객님의 기존 계약/수납 데이터(./data)는 100% 안전하게 유지됩니다.
echo.

where docker >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [1/3] 기존 컨테이너 정지 중...
    docker compose -f docker-compose.standalone.yml down
    echo [2/3] 최신 이미지 빌드 및 재기동 중...
    docker compose -f docker-compose.standalone.yml up -d --build
    echo [3/3] 업데이트 성공! 브라우저를 오픈합니다.
    timeout /t 2 >nul
    start http://localhost
    goto :END
)

echo 로컬 파이썬 환경 재시작...
py standalone_runner.py

:END
pause
