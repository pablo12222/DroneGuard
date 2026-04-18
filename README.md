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

- put your file into `videos/`
- or upload it from the app
- start a mission and open **Drone View**

Default demo video:

- `trasa1.mp4`

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

