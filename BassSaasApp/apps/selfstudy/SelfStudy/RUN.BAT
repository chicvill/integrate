@echo off
echo Starting SelfStudy Platform...

echo 1. Starting Backend API server (Port 8001)...
start "SelfStudy Backend" cmd /k "cd backend && call .venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

echo 2. Starting Frontend React server...
start "SelfStudy Frontend" cmd /k "cd frontend && npm run dev"

echo All services started successfully!
echo Please check the new command prompt windows for logs.
pause
