@echo off
setlocal
cd /d "%~dp0frontend"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required. Install the LTS version from https://nodejs.org/
  pause
  exit /b 1
)
npm install
if errorlevel 1 (
  echo Frontend dependency installation failed.
  pause
  exit /b 1
)
echo Frontend dependencies installed.
pause
