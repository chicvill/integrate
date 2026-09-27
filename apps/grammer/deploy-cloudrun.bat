@echo off
setlocal
cd /d "%~dp0"
title Deploy Grammar Quest to Google Cloud Run

echo ===================================================================
echo   Deploying Grammar Quest TV to Google Cloud Run
echo ===================================================================
echo.

set "SDK_BIN=C:\Users\USER\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
if exist "%SDK_BIN%\gcloud.cmd" (
    set "PATH=%SDK_BIN%;%PATH%"
)
if "%CLOUDSDK_PYTHON%"=="" (
    if exist "C:\Python314\python.exe" set "CLOUDSDK_PYTHON=C:\Python314\python.exe"
)

where gcloud >nul 2>&1
if errorlevel 1 goto :no_gcloud

echo Checking active GCP account and project...
call gcloud config get-value account
call gcloud config get-value project
echo.

set REGION=asia-northeast3
set SERVICE_NAME=grammer-tv

echo Deploying service [%SERVICE_NAME%] to region [%REGION%]...
echo Google Cloud Build will remotely build the container image and deploy.
echo.

call gcloud run deploy %SERVICE_NAME% --source . --region %REGION% --allow-unauthenticated --port 3000

if errorlevel 1 goto :deploy_failed

echo.
echo ===================================================================
echo  [SUCCESS] Successfully deployed to Google Cloud Run!
echo  You can access your TV Game using the Service URL displayed above.
echo ===================================================================
goto :end

:no_gcloud
echo [ERROR] Google Cloud SDK (gcloud) is not found in PATH.
echo Please install Google Cloud SDK from https://cloud.google.com/sdk/
goto :end

:deploy_failed
echo.
echo [ERROR] Deployment failed. Please review the error message above.

:end
pause
