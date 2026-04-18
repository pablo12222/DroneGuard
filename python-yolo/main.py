"""
YOLO Inference Service for Drone Inspection
Serves detections from E:/Hackaton/best.pt
Run: uvicorn main:app --host 0.0.0.0 --port 8000
"""

import os
import base64
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

MODEL_PATH = Path(r"E:\Hackaton\DroneGuard\best.pt")

CLASS_NAMES = [
    "yoke", "yoke suspension", "spacer", "stockbridge damper",
    "lightning rod shackle", "lightning rod suspension", "polymer insulator",
    "glass insulator", "tower id plate", "vari-grip",
    "polymer insulator lower shackle", "polymer insulator upper shackle",
    "polymer insulator tower shackle", "glass insulator big shackle",
    "glass insulator small shackle", "glass insulator tower shackle",
    "spiral damper", "sphere",
]

ANOMALY_CLASSES = {3, 4, 6, 7, 9, 10, 11, 12, 13, 14, 15}
SEVERITY_MAP = {
    "vari-grip": "high",
    "glass insulator": "high",
    "glass insulator tower shackle": "high",
    "polymer insulator": "high",
    "polymer insulator tower shackle": "medium",
    "stockbridge damper": "medium",
    "lightning rod shackle": "medium",
    "spacer": "medium",
}

app = FastAPI(title="DroneGuard YOLO Service", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

model = None


def load_model():
    global model
    if model is not None:
        return model
    try:
        from ultralytics import YOLO
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found at {MODEL_PATH}")
        model = YOLO(str(MODEL_PATH))
        print(f"✓ Model loaded from {MODEL_PATH}")
        return model
    except Exception as e:
        print(f"✗ Failed to load model: {e}")
        raise


class DetectRequest(BaseModel):
    frame_path: Optional[str] = None
    image_base64: Optional[str] = None
    timestamp: float = 0.0
    confidence_threshold: float = 0.5


class Detection(BaseModel):
    id: str
    classId: int
    className: str
    confidence: float
    bbox: dict
    isAnomaly: bool
    severity: str
    timestamp: float


@app.on_event("startup")
async def startup():
    try:
        load_model()
    except Exception as e:
        print(f"Warning: Model not loaded at startup — {e}")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "model_path": str(MODEL_PATH),
        "model_exists": MODEL_PATH.exists(),
    }


@app.post("/detect")
def detect(req: DetectRequest):
    import cv2
    import numpy as np

    m = load_model()

    # Load frame
    if req.frame_path:
        frame = cv2.imread(req.frame_path)
        if frame is None:
            raise HTTPException(400, f"Cannot read image: {req.frame_path}")
    elif req.image_base64:
        data = base64.b64decode(req.image_base64)
        arr = np.frombuffer(data, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(400, "Cannot decode base64 image")
    else:
        raise HTTPException(400, "Provide frame_path or image_base64")

    results = m.predict(
        source=frame,
        conf=req.confidence_threshold,
        iou=0.45,
        imgsz=800,
        verbose=False,
    )
    detections = []

    for i, box in enumerate(results[0].boxes):
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        cls_name = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else f"class_{cls_id}"
        is_anomaly = cls_id in ANOMALY_CLASSES
        severity = SEVERITY_MAP.get(cls_name, "low")

        detections.append({
            "id": f"yolo_{int(req.timestamp * 1000)}_{i}",
            "classId": cls_id,
            "className": cls_name,
            "confidence": round(conf, 4),
            "bbox": {"x": round(x1), "y": round(y1), "w": round(x2 - x1), "h": round(y2 - y1)},
            "isAnomaly": is_anomaly,
            "severity": severity,
            "timestamp": req.timestamp,
        })

    # Annotated frame — identical to results[0].plot() from training code
    import io
    from PIL import Image as PILImage
    annotated_bgr = results[0].plot()
    annotated_rgb = cv2.cvtColor(annotated_bgr, cv2.COLOR_BGR2RGB)
    buf = io.BytesIO()
    PILImage.fromarray(annotated_rgb).save(buf, format="JPEG", quality=82)
    annotated_b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "detections": detections,
        "frameTimestamp": req.timestamp,
        "count": len(detections),
        "annotatedFrame": annotated_b64,
    }


@app.post("/detect-video-frame")
def detect_video_frame(video_path: str, frame_number: int = 0, confidence: float = 0.5):
    import cv2
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise HTTPException(400, f"Cannot open video: {video_path}")

    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        raise HTTPException(400, f"Cannot read frame {frame_number}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    timestamp = frame_number / fps

    import tempfile, cv2
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        cv2.imwrite(tmp.name, frame)
        req = DetectRequest(frame_path=tmp.name, timestamp=timestamp, confidence_threshold=confidence)
        result = detect(req)
        os.unlink(tmp.name)
        return result
