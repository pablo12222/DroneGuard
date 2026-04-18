@echo off
echo Starting DroneGuard Backend...
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%backend"
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
npm run dev
pause
