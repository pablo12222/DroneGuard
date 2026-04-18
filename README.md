# DroneGuard

Proof-of-concept platform for drone-based power line inspection with a live dashboard, simulated mission control, and YOLO-based visual detection from uploaded video.

## Overview

DroneGuard combines three parts:

- a `React + Vite` frontend for the operator dashboard
- a `Node.js + Express` backend for mission control, SSE events, route data, and video serving
- an optional `FastAPI + YOLO` service for live detection overlays and anomaly classification

The current flow is:

1. start backend, frontend, and optionally the YOLO service
2. upload or select a video from the `videos/` folder
3. launch a mission from the dashboard
4. watch the drone route on the map and view live detections in Drone View

## Main Features

- Live operator dashboard with map and drone camera view
- Simulated inspection missions over predefined routes
- Server-Sent Events stream for telemetry and mission logs
- Video upload and local video playback from the repo `videos/` directory
- YOLO-based box overlay on video frames
- Additional classifier stage for condition labels such as `good`, `rust`, `missing-cap`, and `bird-nest`
- Live cumulative counting of detections and anomalies from video analysis
- Optional GPU acceleration for YOLO inference

## Architecture

```text
DroneGuard/
|- backend/        Express API, mission simulation, SSE, video routes
|- frontend/       React dashboard UI
|- python-yolo/    FastAPI inference service
|- models/         Detector and classifier weights
|- data/           Routes and mock detections
|- videos/         Uploaded or manually copied inspection videos
|- start-backend.bat
|- start-frontend.bat
`- start-yolo.bat
```

### Frontend

The frontend is built with:

- `react`
- `vite`
- `tailwindcss`
- `leaflet`
- `react-leaflet`
- `lucide-react`

Main responsibilities:

- drone control panel
- map route visualization
- drone camera view
- live log panel
- weather and mission status display

### Backend

The backend is built with:

- `express`
- `cors`
- `uuid`
- `node-fetch`

Main responsibilities:

- mission lifecycle management
- simulated drone telemetry
- SSE streaming
- route and detection APIs
- video upload and static video serving from `/videos`

### YOLO Service

The Python service uses:

- `fastapi`
- `uvicorn`
- `ultralytics`
- `opencv-python-headless`
- `numpy`
- `Pillow`
- `torchvision`

Main responsibilities:

- frame inference from uploaded video
- detector inference using the selected `.pt` model
- optional classifier inference per crop
- returning normalized detections and annotated frame output

## Models

The project now keeps model files in `models/`:

- `models/detectors/demo-best.pt`
- `models/detectors/legacy-best.pt`
- `models/classifiers/*.pt`

The YOLO service prefers `demo-best.pt` and falls back to `legacy-best.pt` if needed.

## Requirements

Install these tools before running the project:

- `Node.js 18+` with `npm`
- `Python 3.10+`
- `Git`

Optional for GPU inference:

- NVIDIA GPU
- compatible CUDA / driver setup
- CUDA-enabled PyTorch environment

## Quick Start

### Option 1: Use the provided `.bat` files

From the project root:

- run `start-backend.bat`
- run `start-frontend.bat`
- run `start-yolo.bat` if you want live AI detection

These scripts install missing dependencies automatically when possible.

### Option 2: Manual startup

#### Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on:

- `http://localhost:3001`
- health: `http://localhost:3001/api/health`

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

- `http://localhost:5173`

#### YOLO Service

```bash
cd python-yolo
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

YOLO service runs on:

- `http://localhost:8000`
- health: `http://localhost:8000/health`

## How To Use

1. Start backend and frontend.
2. Optionally start the YOLO service.
3. Add a video to the `videos/` folder, or upload it from the UI.
4. Open the dashboard at `http://localhost:5173`.
5. Start a mission.
6. Switch to `Drone View` to see the video with AI overlays.
7. Watch detections, anomalies, and mission logs update live.

## Video Handling

Videos are served from the repository-level `videos/` folder.

You can:

- manually copy files into `videos/`
- or upload them through the app using the backend video API

Available video endpoints:

- `GET /api/videos` - list available video files
- `POST /api/videos/upload` - upload a video file
- `GET /videos/<filename>` - direct static file access

## API Summary

### Inspection

- `POST /api/inspection/start`
- `POST /api/inspection/pause`
- `POST /api/inspection/reset`
- `DELETE /api/inspection/:id`

### Mission / Stream

- `GET /api/mission/:id/stream`

### Routes and Detections

- `GET /api/routes`
- `GET /api/routes/:id`
- `GET /api/detections/:inspectionId`

### Health

- `GET /api/health`
- `GET /health` on the YOLO service

## Live Detection Logic

When the YOLO service is enabled:

- the frontend samples frames from the selected video
- frames are sent to the Python service
- YOLO returns detected boxes
- the UI renders those boxes directly over the playing video
- the dashboard counts live detections and anomalies cumulatively during the mission

The mission simulation and the video pipeline are connected, but they are not the same thing:

- backend mission state drives route progress, telemetry, and SSE logs
- YOLO drives live video boxes and AI-based detection counters

## Troubleshooting

### YOLO does not start

Check:

- Python is installed and available as `python` or `py -3`
- `python-yolo/venv` was created correctly
- `pip install -r requirements.txt` completed without errors

### YOLO runs on CPU instead of GPU

Check:

- `torch.cuda.is_available()` returns `True`
- NVIDIA drivers are installed
- your PyTorch environment is CUDA-enabled
- `/health` from the YOLO service reports `device: cuda:0`

### Video appears but no boxes are shown

Check:

- the YOLO service is running on `localhost:8000`
- the selected model exists in `models/detectors/`
- the video is actually being sent for inference
- the model can detect objects in that specific footage

### Repository not found on GitHub

This usually means:

- the repository is private
- the user was not added as a collaborator
- the user is logged into the wrong GitHub account

## Development Notes

- Frontend and backend use relative paths from the project root.
- The backend serves videos directly from the root `videos/` directory.
- The default demo drone uses `trasa1.mp4`.
- The drone video can loop during a running mission.

## License

This repository currently does not define a separate license file.
