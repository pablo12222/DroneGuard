# DroneGuard

**Autonomous drone inspection platform for energy infrastructure** — real-time mission control, live telemetry, multi-drone fleet management, and on-device AI anomaly detection via YOLO.

Built for TAURON as a hackathon proof-of-concept.

---

<video src="demo/demo.mp4" autoplay loop muted playsinline width="100%"></video>

> **GitHub users:** video tag is not rendered on GitHub — open `demo/demo.mp4` directly or use the GIF below.

![DroneGuard demo](demo/demo_small.gif)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend  :5173                       │
│   React · Vite · Tailwind · Leaflet · SSE streaming     │
└────────────────────────┬────────────────────────────────┘
                         │  REST + Server-Sent Events
┌────────────────────────▼────────────────────────────────┐
│                    Backend  :3001                        │
│   Node.js · Express · mission simulation · route data   │
└────────────────────────┬────────────────────────────────┘
                         │  HTTP (base64 frames)
┌────────────────────────▼────────────────────────────────┐
│                  YOLO Service  :8000                     │
│   Python · FastAPI · Ultralytics · detector + classifier │
└─────────────────────────────────────────────────────────┘
```

### Mission flow

1. User selects a preset route or draws a custom one on the map.
2. Clicking **Start** POSTs to the backend — the backend starts mission simulation and opens an SSE stream.
3. The frontend receives telemetry events (`drone_position`, `detection`, `log`, `inspection_complete`) and updates the map, fleet panel, and log in real time.
4. In **Drone View**, video frames are captured from the canvas, encoded as JPEG/base64, and sent to the YOLO service every N frames.
5. YOLO returns bounding boxes; confirmed anomalies are pinned on the map with a screenshot of the detection frame.
6. On mission complete, the drone animates a return flight at simulation speed; the video plays in reverse.

---

## File structure

```
DroneGuard/
│
├── backend/                        # Node.js / Express API
│   ├── routes/
│   │   ├── inspection.js           # start / pause / reset mission
│   │   ├── mission.js              # SSE stream per mission
│   │   ├── routesApi.js            # serve route JSON files
│   │   ├── detections.js           # detections endpoint
│   │   └── videos.js               # video upload + static hosting
│   ├── services/
│   │   ├── simulationService.js    # tick-based drone position simulation
│   │   ├── detectionService.js     # route-based synthetic anomaly generation
│   │   └── weatherService.js       # weather data per region
│   ├── server.js                   # Express app entry point
│   └── package.json
│
├── frontend/                       # React + Vite SPA
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapView.jsx         # Leaflet map, routes, detection pins, modal
│   │   │   ├── DroneView.jsx       # video player, YOLO overlay, HUD
│   │   │   ├── ControlPanel.jsx    # mission controls, fleet switcher, status
│   │   │   ├── DroneFleet.jsx      # fleet list with anomaly badges
│   │   │   ├── LogPanel.jsx        # real-time mission log
│   │   │   ├── WeatherPanel.jsx    # weather chip in header
│   │   │   └── AddDroneModal.jsx   # add-drone dialog
│   │   ├── hooks/
│   │   │   └── useSSE.js
│   │   ├── utils/
│   │   │   └── api.js              # thin fetch wrapper
│   │   ├── App.jsx                 # root state, drone Map, SSE wiring
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── python-yolo/                    # FastAPI inference service
│   ├── main.py                     # /detect endpoint
│   ├── requirements.txt
│   └── venv/
│
├── models/                         # YOLO weights
│   ├── detectors/                  # primary object detection model
│   └── classifiers/                # asset-specific classifiers
│
├── data/
│   ├── routes/                     # GeoJSON-style route definitions
│   │   ├── route_silesia.json      # Gliwice 110 kV
│   │   ├── route_malopolska.json
│   │   └── route_mazowsze.json
│   └── detections/
│       └── demo_detections.json
│
├── videos/                         # Inspection footage (served as static)
│   └── trasa1.mp4
│
├── start-backend.bat
├── start-frontend.bat
└── start-yolo.bat
```

---

## Requirements

| Runtime | Version |
|---------|---------|
| Node.js | ≥ 18 |
| Python  | ≥ 3.10 |
| GPU     | optional — NVIDIA + CUDA for fast inference |

---

## Quick start

From the project root, run each script in a separate terminal:

```bat
start-backend.bat
start-frontend.bat
start-yolo.bat
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001/api/health |
| YOLO service | http://localhost:8000/health |

---

## Manual setup

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### YOLO service

```bash
cd python-yolo
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Key API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/inspection/start` | Start a new mission |
| `POST` | `/api/inspection/pause` | Pause / resume |
| `POST` | `/api/inspection/reset` | Abort and reset |
| `GET`  | `/api/mission/:id/stream` | SSE telemetry stream |
| `GET`  | `/api/routes/:id` | Fetch route waypoints |
| `GET`  | `/api/videos` | List available videos |
| `POST` | `/api/videos/upload` | Upload inspection video |
| `GET`  | `/videos/:filename` | Serve video file |

---

## YOLO inference

The frontend captures video frames on a configurable stride and posts them to the YOLO service:

```
POST http://localhost:8000/detect
Content-Type: application/json

{ "image_base64": "...", "timestamp": 9.2, "confidence_threshold": 0.20 }
```

Response includes bounding boxes with class name, confidence, severity, and `isAnomaly` flag. Confirmed anomaly tracks (≥ 2 anomaly hits) trigger a map pin with a JPEG snapshot of the detection frame.

Models are loaded from:
- `models/detectors/` — primary detection weights
- `models/classifiers/` — per-asset classifier weights
