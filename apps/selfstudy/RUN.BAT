@echo off
echo Starting SelfStudy Platform...

if not exist "backend\.venv\Scripts\activate.bat" (
    echo Creating Python virtual environment in backend\.venv...
    python -m venv backend\.venv
    call backend\.venv\Scripts\activate.bat
    pip install -r backend\requirements.txt
)

echo 1. Starting Backend API server (Port 8001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
start "SelfStudy Backend" cmd /k "cd backend && call .venv\Scripts\activate.bat && python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

echo 2. Starting Frontend React server...
start "SelfStudy Frontend" cmd /k "cd frontend && npm run dev"

echo All services started successfully!
echo Please check the new command prompt windows for logs.
pause
