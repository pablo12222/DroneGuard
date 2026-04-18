"""
YOLO inference service for DroneGuard.
Prefers the detector/classifiers extracted from bot.zip when available.
"""

import base64
import io
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_ROOT = PROJECT_ROOT / "models"
DETECTOR_DIR = MODEL_ROOT / "detectors"
CLASSIFIER_DIR = MODEL_ROOT / "classifiers"
PRIMARY_DETECTOR_PATH = DETECTOR_DIR / "demo-best.pt"
FALLBACK_DETECTOR_PATH = DETECTOR_DIR / "legacy-best.pt"
DETECTOR_MODEL_PATH = PRIMARY_DETECTOR_PATH if PRIMARY_DETECTOR_PATH.exists() else FALLBACK_DETECTOR_PATH

DETECTOR_IOU = 0.45
DETECTOR_IMG_SIZE = 800
CROP_PADDING = 0.10
CLASSIFIER_INPUT_SIZE = 224

CLASSIFIER_PATHS = {
    "glass insulator": CLASSIFIER_DIR / "glass-insulator_best.pt",
    "lightning rod suspension": CLASSIFIER_DIR / "lightning-rod-suspension_best.pt",
    "polymer insulator upper shackle": CLASSIFIER_DIR / "polymer-insulator-upper-shackle_best.pt",
    "vari-grip": CLASSIFIER_DIR / "vari-grip_best.pt",
    "yoke suspension": CLASSIFIER_DIR / "yoke-suspension_best.pt",
}

CONDITION_SEVERITY = {
    "good": ("low", False),
    "rust": ("medium", True),
    "missing-cap": ("high", True),
    "bird-nest": ("high", True),
}

app = FastAPI(title="DroneGuard YOLO Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

model = None
classifiers = {}
device = "cpu"
classifier_transform = None


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
    assetName: Optional[str] = None
    conditionLabel: Optional[str] = None
    classifierConfidence: Optional[float] = None


def resolve_device():
    try:
        import torch
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def expand_box(x1, y1, x2, y2, img_w, img_h, padding=CROP_PADDING):
    width = x2 - x1
    height = y2 - y1
    pad_w = int(width * padding)
    pad_h = int(height * padding)
    return (
        max(0, x1 - pad_w),
        max(0, y1 - pad_h),
        min(img_w, x2 + pad_w),
        min(img_h, y2 + pad_h),
    )


def draw_box_with_label(image, x1, y1, x2, y2, label, color):
    import cv2

    cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
    (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    box_top = max(0, y1 - text_h - baseline - 8)
    box_bottom = max(0, y1)
    box_right = min(image.shape[1], x1 + text_w + 10)

    cv2.rectangle(image, (x1, box_top), (box_right, box_bottom), color, thickness=-1)
    cv2.putText(
        image,
        label,
        (x1 + 5, box_bottom - 5),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0, 0, 0),
        2,
        cv2.LINE_AA,
    )


def label_color(condition_label):
    if condition_label == "good":
        return (0, 255, 0)
    if condition_label:
        return (0, 165, 255)
    return (255, 255, 0)


def build_display_label(asset_name, condition_label):
    if condition_label:
        return f"{asset_name} | {condition_label}"
    return asset_name


def describe_condition(condition_label):
    severity, is_anomaly = CONDITION_SEVERITY.get(condition_label or "", ("low", False))
    return severity, is_anomaly


def load_model():
    global model, device
    if model is not None:
        return model

    from ultralytics import YOLO

    device = resolve_device()
    if not DETECTOR_MODEL_PATH.exists():
        raise FileNotFoundError(f"Detector model not found at {DETECTOR_MODEL_PATH}")

    model = YOLO(str(DETECTOR_MODEL_PATH))
    model.to(device)
    print(f"Loaded detector from {DETECTOR_MODEL_PATH} on {device}")
    return model


def load_single_classifier(checkpoint_path: Path):
    import torch
    import torch.nn as nn
    from torchvision import models

    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Classifier not found at {checkpoint_path}")

    checkpoint = torch.load(str(checkpoint_path), map_location=device)
    classes = checkpoint["classes"]

    classifier = models.resnet18(weights=None)
    classifier.fc = nn.Linear(classifier.fc.in_features, len(classes))
    classifier.load_state_dict(checkpoint["model_state_dict"])
    classifier.to(device)
    classifier.eval()
    return classifier, classes


def load_classifiers():
    global classifiers, classifier_transform
    if classifiers:
        return classifiers

    from torchvision import transforms

    classifier_transform = transforms.Compose([
        transforms.Resize((CLASSIFIER_INPUT_SIZE, CLASSIFIER_INPUT_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])

    loaded = {}
    for asset_name, checkpoint_path in CLASSIFIER_PATHS.items():
        if not checkpoint_path.exists():
            continue
        try:
            classifier, classes = load_single_classifier(checkpoint_path)
            loaded[asset_name] = {"model": classifier, "classes": classes, "path": str(checkpoint_path)}
            print(f"Loaded classifier for {asset_name}: {classes}")
        except Exception as exc:
            print(f"Failed to load classifier for {asset_name}: {exc}")

    classifiers = loaded
    return classifiers


def classify_crop(crop_bgr, asset_name):
    if asset_name not in classifiers:
        return None, None
    if crop_bgr is None or crop_bgr.size == 0:
        return None, None

    import cv2
    import torch
    from PIL import Image

    crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
    tensor = classifier_transform(Image.fromarray(crop_rgb)).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = classifiers[asset_name]["model"](tensor)
        probs = torch.softmax(logits, dim=1)
        pred_idx = int(torch.argmax(probs, dim=1).item())
        pred_conf = float(probs[0, pred_idx].item())

    return classifiers[asset_name]["classes"][pred_idx], pred_conf


def decode_frame(req: DetectRequest):
    import cv2
    import numpy as np

    if req.frame_path:
        frame = cv2.imread(req.frame_path)
        if frame is None:
            raise HTTPException(400, f"Cannot read image: {req.frame_path}")
        return frame

    if req.image_base64:
        data = base64.b64decode(req.image_base64)
        arr = np.frombuffer(data, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(400, "Cannot decode base64 image")
        return frame

    raise HTTPException(400, "Provide frame_path or image_base64")


def predict_frame(frame, confidence_threshold, timestamp):
    import cv2
    from PIL import Image as PILImage

    detector = load_model()
    load_classifiers()

    results = detector.predict(
        source=frame,
        conf=confidence_threshold,
        iou=DETECTOR_IOU,
        imgsz=DETECTOR_IMG_SIZE,
        device=0 if device.startswith("cuda") else "cpu",
        verbose=False,
    )

    result = results[0]
    names = result.names
    annotated = frame.copy()
    detections = []

    if result.boxes is None:
        return detections, ""

    img_h, img_w = frame.shape[:2]

    for index, box in enumerate(result.boxes):
        cls_id = int(box.cls[0].item())
        det_conf = float(box.conf[0].item())
        raw_name = names.get(cls_id, f"class_{cls_id}") if isinstance(names, dict) else names[cls_id]

        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        x1, y1, x2, y2 = expand_box(x1, y1, x2, y2, img_w, img_h)
        crop = frame[y1:y2, x1:x2]

        condition_label, classifier_conf = classify_crop(crop, raw_name)
        display_label = build_display_label(raw_name, condition_label)
        severity, is_anomaly = describe_condition(condition_label)

        draw_box_with_label(annotated, x1, y1, x2, y2, display_label, label_color(condition_label))

        detections.append({
            "id": f"yolo_{int(timestamp * 1000)}_{index}",
            "classId": cls_id,
            "className": display_label,
            "confidence": round(det_conf, 4),
            "bbox": {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1},
            "isAnomaly": is_anomaly,
            "severity": severity,
            "timestamp": timestamp,
            "assetName": raw_name,
            "conditionLabel": condition_label,
            "classifierConfidence": round(classifier_conf, 4) if classifier_conf is not None else None,
        })

    rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
    buffer = io.BytesIO()
    PILImage.fromarray(rgb).save(buffer, format="JPEG", quality=82)
    return detections, base64.b64encode(buffer.getvalue()).decode()


@app.on_event("startup")
async def startup():
    try:
        load_model()
        load_classifiers()
    except Exception as exc:
        print(f"Warning: model startup incomplete: {exc}")


@app.get("/health")
def health():
    classifier_info = {
        name: data["path"]
        for name, data in classifiers.items()
    }
    return {
        "status": "ok",
        "device": device,
        "detector_model_path": str(DETECTOR_MODEL_PATH),
        "detector_model_exists": DETECTOR_MODEL_PATH.exists(),
        "detector_model_loaded": model is not None,
        "classifiers_loaded": sorted(classifiers.keys()),
        "classifier_paths": classifier_info,
    }


@app.post("/detect")
def detect(req: DetectRequest):
    frame = decode_frame(req)
    detections, annotated_b64 = predict_frame(frame, req.confidence_threshold, req.timestamp)
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

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        raise HTTPException(400, f"Cannot read frame {frame_number}")

    detections, annotated_b64 = predict_frame(frame, confidence, frame_number / fps)
    return {
        "detections": detections,
        "frameTimestamp": frame_number / fps,
        "count": len(detections),
        "annotatedFrame": annotated_b64,
    }
