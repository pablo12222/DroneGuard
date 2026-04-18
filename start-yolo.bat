@echo off
echo Starting YOLO Inference Service...

set "ROOT_DIR=%~dp0"
set "YOLO_DIR=%ROOT_DIR%python-yolo"
set "VENV=%YOLO_DIR%\venv"
set "PYTHON=%VENV%\Scripts\python.exe"
set "PIP=%VENV%\Scripts\pip.exe"
set "UVICORN=%VENV%\Scripts\uvicorn.exe"

if exist "%VENV%\Scripts\python.exe" goto :install

echo Creating Python virtual environment...
py -3 -m venv "%VENV%"
if errorlevel 1 (
    echo ERROR: Failed to create venv. Make sure Python 3 is installed.
    pause
    exit /b 1
)

:install
echo Upgrading pip...
"%PYTHON%" -m pip install --upgrade pip --quiet

echo Installing dependencies...
"%PIP%" install fastapi "uvicorn[standard]" ultralytics Pillow python-multipart numpy opencv-python-headless
if errorlevel 1 (
    echo ERROR: pip install failed.
    pause
    exit /b 1
)

echo.
echo ====================================
echo  YOLO Service: http://localhost:8000
echo ====================================
cd /d "%YOLO_DIR%"
"%UVICORN%" main:app --host 0.0.0.0 --port 8000
pause
