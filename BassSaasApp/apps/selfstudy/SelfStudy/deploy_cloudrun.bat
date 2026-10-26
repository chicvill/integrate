@echo off
chcp 65001 > nul
echo ========================================================
echo   SelfStudy Platform - Google Cloud Run Deploy Script
echo ========================================================
echo.

:: 1. Check gcloud CLI
where gcloud >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] gcloud CLI가 설치되어 있지 않거나 PATH에 없습니다.
    echo https://cloud.google.com/sdk/docs/install 에서 Google Cloud SDK를 설치해 주세요.
    pause
    exit /b 1
)

:: 2. Set default parameters
set SERVICE_NAME=selfstudy
set REGION=asia-northeast3

echo [INFO] Google Cloud Run 배포를 시작합니다...
echo - 서비스명: %SERVICE_NAME%
echo - 리전: %REGION%
echo.

:: 3. Read .env file for environment variables if available
set ENV_VARS=
if exist .env (
    echo [.env 발견] 환경 변수를 파싱합니다...
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" if not "%%B"=="" (
            if "%%A"=="GEMINI_API_KEY" set "GEMINI_API_KEY=%%B"
            if "%%A"=="DATABASE_URL" set "DATABASE_URL=%%B"
        )
    )
)

if not "%GEMINI_API_KEY%"=="" (
    set "ENV_VARS=GEMINI_API_KEY=%GEMINI_API_KEY%"
)
if not "%DATABASE_URL%"=="" (
    if not "%ENV_VARS%"=="" (
        set "ENV_VARS=%ENV_VARS%,DATABASE_URL=%DATABASE_URL%"
    ) else (
        set "ENV_VARS=DATABASE_URL=%DATABASE_URL%"
    )
)

if not "%ENV_VARS%"=="" (
    echo [ENV] 전달할 환경변수 세팅 완료 (GEMINI_API_KEY, DATABASE_URL)
    echo gcloud run deploy 실행 중...
    gcloud run deploy %SERVICE_NAME% --source . --region %REGION% --allow-unauthenticated --set-env-vars "%ENV_VARS%"
) else (
    echo [WARN] .env 파일에서 GEMINI_API_KEY 또는 DATABASE_URL을 찾지 못했습니다. 기본 배포를 진행합니다.
    echo gcloud run deploy 실행 중...
    gcloud run deploy %SERVICE_NAME% --source . --region %REGION% --allow-unauthenticated
)

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Google Cloud Run 배포가 성공적으로 완료되었습니다!
) else (
    echo.
    echo [FAIL] 배포 중 오류가 발생하였습니다. 위 로그를 확인해 주세요.
)

pause
