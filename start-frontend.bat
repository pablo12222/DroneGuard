@echo off
echo Starting DroneGuard Frontend...
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%frontend"
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
npm run dev
pause
