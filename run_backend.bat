@echo off
echo [*] Starting Panzira AI Python Backend...
cd "%~dp0backend"
set PYTHONPATH=%~dp0backend
python run.py
pause
