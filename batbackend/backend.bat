@echo off
echo ================================================================
echo   Intelligent Waste Classifier (Frontend & Backend Launcher)
echo ================================================================

IF NOT EXIST ".venv" (
    echo [INFO] Creating Python virtual environment (.venv)...
    python -m venv .venv
)

echo [INFO] Activating virtual environment...
call .venv\Scripts\activate.bat

echo [INFO] Installing / updating dependencies from backend\requirements.txt...
python -m pip install -r backend\requirements.txt

echo.
echo ================================================================
echo   Launching FastAPI Server & Web App at http://127.0.0.1:8000
echo   API Docs available at http://127.0.0.1:8000/docs
echo ================================================================
echo.

start http://127.0.0.1:8000
uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload

pause
