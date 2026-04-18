# DroneGuard 🚁

DroneGuard is a proof-of-concept system for **power line inspection** using a drone dashboard, mission simulation, and **YOLO-based video detection**.

## ✨ What It Does

- shows the drone route on a live map
- plays inspection video in Drone View
- overlays YOLO detections directly on the video
- counts live detections and anomalies
- streams telemetry and mission logs in real time

## 🧱 Stack

- `frontend/` - React + Vite + Tailwind
- `backend/` - Node.js + Express + SSE
- `python-yolo/` - FastAPI + Ultralytics YOLO
- `models/` - detector and classifier weights
- `videos/` - inspection videos

## 🏗️ Architecture

```text
Frontend (React)
    |
    | HTTP + SSE
    v
Backend (Express)
    |- mission simulation
    |- routes / detections API
    |- video upload + /videos static hosting
    |
    | frame requests
    v
YOLO Service (FastAPI)
    |- detector model
    `- classifier models
```

### Flow

1. The backend starts an inspection mission and streams telemetry.
2. The frontend displays the route, logs, and drone state.
3. In Drone View, video frames are sent to the YOLO service.
4. YOLO returns detections, and the frontend renders boxes live on the video.

## ✅ Requirements

- `Node.js`
- `Python 3`
- `Git`
- optional: `NVIDIA GPU + CUDA` for faster YOLO inference

## 🚀 Quick Start

Run these from the project root:

```bat
start-backend.bat
start-frontend.bat
start-yolo.bat
```

Then open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3001/api/health`
- YOLO health: `http://localhost:8000/health`

## 🎥 Video

Videos are handled from the root `videos/` folder.

You can:

- copy a file manually into `videos/`
- or upload it from the app

Supported flow:

1. place or upload a file such as `trasa1.mp4`
2. start a mission
3. open **Drone View**
4. the frontend loads the file from `/videos/<filename>`
5. if YOLO is running, live boxes are drawn over the video

Default demo video:

- `trasa1.mp4`

Useful endpoints:

- `GET /api/videos` - list available files
- `POST /api/videos/upload` - upload a file
- `GET /videos/<filename>` - direct video access

## 🤖 YOLO

The app uses models from:

- `models/detectors/`
- `models/classifiers/`

YOLO is optional, but without it you will not see live AI boxes on the video.

## 🛠️ Manual Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

### YOLO

```bash
cd python-yolo
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 📌 Notes

- videos are served from the root `videos/` folder
- the backend runs on port `3001`
- the frontend runs on port `5173`
- the YOLO service runs on port `8000`
