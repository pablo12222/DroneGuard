@echo off
echo Starting DroneGuard Backend...
cd /d E:\Hackaton\DroneGuard\backend
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
npm run dev
pause
