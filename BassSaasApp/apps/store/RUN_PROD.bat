@echo off
echo ========================================================
echo   MQnet Store Unified System Production Launcher
echo ========================================================

cd /d "%~dp0"

if not exist .env (
    echo [.env file missing] Copying .env.template to .env...
    copy .env.template .env
)

echo [1/3] Building Frontend (React)...
cd frontend
call npm install
call npm run build
cd ..

echo [2/3] Syncing frontend dist to backend/dist...
if not exist "backend\dist" mkdir "backend\dist"
xcopy /E /Y /Q "frontend\dist\*" "backend\dist\"

echo [3/3] Launching Unified FastAPI Server on Port 8002...
cd backend
if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)

python -m uvicorn main:app --host 0.0.0.0 --port 8002


echo System exited.
pause
