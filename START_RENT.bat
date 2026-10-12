@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 > nul
title MQnet 원룸 임차료 관리 시스템 (29개실) - 실행기

set "BASE=%~dp0"
cd /d "%BASE%"
set "PYTHONPATH=%BASE%"

echo ========================================================
echo   🏢 MQnet 원룸 임차료 관리 시스템 (29개실)
echo   백엔드 DB(integrat.db) 실시간 자동 연동 실행기
echo ========================================================
echo.

REM 1. Python 런처 탐색
set "PY_CMD="
py -3.14 --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=py -3.14"
    goto :found_python
)

if exist "C:\Users\USER\AppData\Local\Programs\Python\Python314\python.exe" (
    set "PY_CMD=C:\Users\USER\AppData\Local\Programs\Python\Python314\python.exe"
    goto :found_python
)

python -c "import sys; sys.exit(0)" >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=python"
    goto :found_python
)

echo [오류] 파이썬을 찾을 수 없습니다.
echo Python 3.14 설치 상태를 확인해주세요.
pause
exit /b 1

:found_python
echo [1/3] 파이썬 환경 확인 완료: !PY_CMD!
echo [2/3] 백엔드 게이트웨이 서버(포트 9000) 기동 중...

REM 브라우저 자동 오픈 (백그라운드에서 2초 뒤 오픈)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:9000/rent/?branch=main"

echo [3/3] 브라우저(http://localhost:9000/rent/)를 자동으로 엽니다.
echo.
echo ========================================================
echo   ✅ 서버가 정상 실행되었습니다!
echo   임차 정보 변경 / 엑셀 업로드 시 DB에 즉시 자동 저장됩니다.
echo   * 이 창을 닫으면 서버가 종료됩니다.
echo ========================================================
echo.

!PY_CMD! -m uvicorn gateway.main:app --host 0.0.0.0 --port 9000 --proxy-headers
pause
