@echo off
echo Starting SelfStudy Platform in Production Mode...

:: Load environment variables from .env
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        set "%%A=%%B"
    )
)

echo 1. Backend is now running 24/7 on Google Cloud Run! (Skipping local backend)
:: start "SelfStudy Backend" cmd /k "cd backend && call .venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8001"

echo 2. Building Frontend React Application...
cd frontend
echo Running npm install...
call npm install
echo Building application...
call npm run build
echo 3. Starting Frontend Production Server (Port 5220)...
start "SelfStudy Frontend Prod" cmd /k "npx serve -s dist -p 5220"
cd ..

if not "%CLOUDFLARE_TUNNEL_TOKEN%"=="" (
    echo 4. Starting Cloudflare Tunnel...
    start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --no-autoupdate run --token %CLOUDFLARE_TUNNEL_TOKEN%"
) else (
    echo Cloudflare Tunnel token not found in .env. Please run it manually or configure it.
)

echo All production services started!
pause
