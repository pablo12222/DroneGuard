@echo off
echo Starting DroneGuard Frontend...
cd /d E:\Hackaton\DroneGuard\frontend
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
npm run dev
pause
