@echo off
setlocal
echo ============================================================
echo   Panzira AI V3 - 1-Click Local Demo Launcher
echo ============================================================
echo.

echo [1/3] Starting Python Backend (FastAPI on http://127.0.0.1:8000)...
start "Panzira AI Backend (Port 8000)" cmd /k "cd /d ""%~dp0backend"" && set PYTHONPATH=%~dp0backend && python run.py"

echo [2/3] Starting React/Vite Frontend (Port 5173)...
start "Panzira AI Frontend (Port 5173)" cmd /k "cd /d ""%~dp0"" && npm run dev -- --port 5173"

echo [3/3] Waiting for services to initialize, then opening browser...
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Live Demo URLs:
echo   - App (Public + Newsroom): http://localhost:5173
echo   - API Docs (Swagger):      http://127.0.0.1:8000/docs
echo.
echo Seeded V3 Demo Accounts (Password: panzira2026):
echo   - Citizen Contributor: tariro@citizen.co.zw
echo   - Journalist Desk:     nqobile@chronicle.co.zw
echo   - Admin / Control:     rudo@panzira.zw
echo.
endlocal
