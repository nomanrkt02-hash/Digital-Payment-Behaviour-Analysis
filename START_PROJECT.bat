@echo off
setlocal
cd /d "%~dp0"

set "ROOT=%~dp0"
set "API_URL=http://127.0.0.1:8000"
set "UI_URL=http://127.0.0.1:8080"

echo ================================================
echo Digital Payment Behaviour Analysis - Start
echo ================================================

if not exist "%ROOT%.venv\Scripts\python.exe" (
  echo Python environment not found. Run SETUP_WINDOWS.bat first.
  pause
  exit /b 1
)
if not exist "%ROOT%frontend\node_modules\vite\bin\vite.js" (
  echo Frontend dependencies not found. Run SETUP_FRONTEND.bat first.
  pause
  exit /b 1
)

REM Reuse only a responding service. Never stop a process that owns a required port.
curl.exe --silent --show-error --fail "%API_URL%/api/health" >nul 2>nul
if errorlevel 1 (
  netstat -ano -p tcp | findstr /R /C:":8000 .*LISTENING" >nul
  if not errorlevel 1 (
    echo ERROR: Port 8000 is occupied, but the expected API health check failed.
    echo Close the known conflicting application yourself, then retry.
    pause
    exit /b 1
  )
  echo Starting backend with the project virtual environment...
  start "DPBA Python API" /D "%ROOT%" cmd /k ""%ROOT%.venv\Scripts\python.exe" -m uvicorn api:app --host 127.0.0.1 --port 8000"
)

echo Waiting for backend readiness at %API_URL%/api/health ...
set /a API_WAIT=0
:wait_for_api
curl.exe --silent --fail "%API_URL%/api/health" >nul 2>nul
if not errorlevel 1 goto api_ready
set /a API_WAIT+=1
if %API_WAIT% GEQ 90 (
  echo ERROR: The Python API did not become ready within 90 seconds.
  echo Check the DPBA Python API window for import, security-policy, or port errors.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait_for_api
:api_ready
curl.exe --silent --show-error --fail "%API_URL%/api/health"
echo.

curl.exe --silent --show-error --fail "%UI_URL%" >nul 2>nul
if errorlevel 1 (
  netstat -ano -p tcp | findstr /R /C:":8080 .*LISTENING" >nul
  if not errorlevel 1 (
    echo ERROR: Port 8080 is occupied, but the expected frontend did not respond.
    echo Close the known conflicting application yourself, then retry.
    pause
    exit /b 1
  )
  echo Starting frontend from the frontend directory...
  start "DPBA React UI" /D "%ROOT%frontend" cmd /k "npm run dev -- --host 127.0.0.1 --port 8080 --strictPort"
)

echo Waiting for frontend readiness at %UI_URL% ...
set /a UI_WAIT=0
:wait_for_ui
curl.exe --silent --fail "%UI_URL%" >nul 2>nul
if not errorlevel 1 goto ui_ready
set /a UI_WAIT+=1
if %UI_WAIT% GEQ 60 (
  echo ERROR: The frontend did not become ready within 60 seconds.
  echo Check the DPBA React UI window for the startup error.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait_for_ui
:ui_ready
echo.
echo Project is ready.
echo Frontend: %UI_URL%
echo Backend:  %API_URL%
start "" "%UI_URL%"
exit /b 0
