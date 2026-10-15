@echo off
chcp 65001 > nul
title MQnet Standalone Solution Updater
echo ========================================================
echo  🔄 MQnet 독립 솔루션 최신 버전 업데이트기
echo ========================================================
echo.
echo [주의] 기존 데이터(./data)는 100% 안전하게 보존됩니다.
echo.

where docker >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [1/3] 기존 컨테이너 안전 정지 중...
    docker compose -f docker-compose.standalone.yml down
    echo [2/3] 최신 코드 기반 재빌드 중...
    docker compose -f docker-compose.standalone.yml up -d --build
    echo [3/3] 업데이트 완료! 브라우저를 오픈합니다.
    timeout /t 2 >nul
    start http://localhost
    goto :END
)

echo [1/2] 로컬 Python 환경 패키지 갱신 중...
pip install --upgrade -r requirements.txt
echo [2/2] 업데이트 완료!
start http://localhost:8000
python standalone_runner.py

:END
pause
