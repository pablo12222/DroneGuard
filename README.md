# DroneGuard — Energy Infrastructure Inspection System

Proof of Concept for drone-based 110kV power line inspection with real-time anomaly detection.

## Architecture

```
E:\Hackaton\DroneGuard
├── backend/          Node.js + Express — API & SSE simulation
├── frontend/         React + Vite + Tailwind — Dashboard UI
├── python-yolo/      FastAPI — YOLO inference (optional)
├── data/
│   ├── routes/       Inspection route definitions (JSON)
│   └── detections/   Mock detection data (JSON)
└── videos/           Place drone footage here (MP4)
```

## Quick Start

### 1. Start Backend (Terminal 1)
```bash
cd E:\Hackaton\DroneGuard\backend
npm install
npm run dev
# Runs on http://localhost:3001
```

### 2. Start Frontend (Terminal 2)
```bash
cd E:\Hackaton\DroneGuard\frontend
npm install
npm run dev
# Opens http://localhost:5173
```

### 3. (Optional) Start YOLO Service (Terminal 3)
```bash
cd E:\Hackaton\DroneGuard\python-yolo
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
# Runs on http://localhost:8000
```

Or just double-click the `.bat` files.

## Using the Dashboard

1. Open **http://localhost:5173**
2. Select route from dropdown (Silesia 110kV is preloaded)
3. Optionally enter a video filename in the **Video File** field (place MP4 in `E:\Hackaton\DroneGuard\videos\`)
4. Click **Start Inspection**
5. Watch the drone move on the map in real time
6. Switch to **Drone View** to see the camera feed + detection overlays
7. Monitor anomaly alerts in the **System Log** panel
8. Click red alert triangles on the map for detection details

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/inspection/start | Start inspection mission |
| POST | /api/inspection/pause | Pause/resume mission |
| POST | /api/inspection/reset | Reset mission |
| GET  | /api/inspection/:id/status | Current mission state |
| GET  | /api/mission/:id/stream | SSE event stream |
| GET  | /api/routes | List available routes |
| GET  | /api/routes/:id | Full route with waypoints |
| GET  | /api/detections/:inspectionId | Detections for mission |

## YOLO Classes

| ID | Class | Anomaly |
|----|-------|---------|
| 0 | yoke | — |
| 3 | stockbridge damper | ⚠ medium |
| 4 | lightning rod shackle | ⚠ medium |
| 6 | polymer insulator | ⚠ high |
| 7 | glass insulator | ⚠ high |
| 9 | vari-grip | ⚠ high |
| 15 | glass insulator tower shackle | ⚠ high |

## Adding a Video

1. Copy any drone inspection video to `E:\Hackaton\DroneGuard\videos\inspection.mp4`
2. In the dashboard Control Panel, enter `inspection.mp4` in the Video File field
3. Start the inspection — the video will sync with the simulation timeline

## Extending with Real YOLO

The Python service at `python-yolo/main.py` connects to `E:\Hackaton\DroneGuard\best.pt`.
When running, the Node backend can call `POST http://localhost:8000/detect` with a frame path.
To enable real inference, edit `backend/services/detectionService.js` and call `runYoloInference()`.
