import time
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
from mss import mss
from PIL import Image
from torchvision import models, transforms


# =========================
# KONFIGURACJA
# =========================
BACKEND = "ultralytics"

MODEL_PATH = r"C:\Users\Qartet\Desktop\trainhack\runs\detect\train3_ft1_safe\weights\best.pt"
MONITOR_INDEX = 1
CONF = 0.20
IOU = 0.45
IMG_SIZE = 800
SHOW_FPS = True
WINDOW_NAME = "YOLO Screen Demo"
DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"

YOLOV5_REPO = "ultralytics/yolov5"
FORCE_RELOAD_YOLOV5 = False

CAPTURE_REGION = {"left": 100, "top": 100, "width": 1920, "height": 1080}

# Minimalny próg pewności klasyfikatora.
# Jeśli classifier ma niższy confidence, nadal pokażemy etykietę,
# ale możesz potem łatwo zmienić logikę np. na "uncertain".
CLS_CONF_THRESHOLD = 0.0

# Padding cropa wokół bboxa wykrytego przez YOLO.
# Często pomaga klasyfikatorowi.
CROP_PADDING = 0.10

# Ścieżki do modeli klasyfikacyjnych
CLASSIFIER_PATHS = {
    "glass insulator": r"C:\Users\Qartet\Desktop\trainhack\outputs\glass-insulator_best.pt",
    "lightning rod suspension": r"C:\Users\Qartet\Desktop\trainhack\outputs\lightning-rod-suspension_best.pt",
    "polymer insulator upper shackle": r"C:\Users\Qartet\Desktop\trainhack\outputs\polymer-insulator-upper-shackle_best.pt",
    "vari-grip": r"C:\Users\Qartet\Desktop\trainhack\outputs\vari-grip_best.pt",
    "yoke suspension": r"C:\Users\Qartet\Desktop\trainhack\outputs\yoke-suspension_best.pt",
}

# Transform dla classifierów
CLS_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


# =========================
# HELPERY
# =========================
def get_capture_area(sct: mss, monitor_index: int, region: dict | None):
    monitor = sct.monitors[monitor_index]
    if region is None:
        return {
            "left": monitor["left"],
            "top": monitor["top"],
            "width": monitor["width"],
            "height": monitor["height"],
        }

    return {
        "left": region.get("left", monitor["left"]),
        "top": region.get("top", monitor["top"]),
        "width": region.get("width", monitor["width"]),
        "height": region.get("height", monitor["height"]),
    }


def expand_box(x1, y1, x2, y2, img_w, img_h, padding=0.10):
    w = x2 - x1
    h = y2 - y1

    pad_w = int(w * padding)
    pad_h = int(h * padding)

    x1 = max(0, x1 - pad_w)
    y1 = max(0, y1 - pad_h)
    x2 = min(img_w, x2 + pad_w)
    y2 = min(img_h, y2 + pad_h)

    return x1, y1, x2, y2


def load_model():
    model_file = Path(MODEL_PATH)
    if not model_file.exists():
        raise FileNotFoundError(f"Nie znaleziono modelu: {MODEL_PATH}")

    if BACKEND == "ultralytics":
        from ultralytics import YOLO
        model = YOLO(str(model_file))
        return model

    if BACKEND == "yolov5":
        model = torch.hub.load(
            YOLOV5_REPO,
            "custom",
            path=str(model_file),
            source="local" if Path(str(YOLOV5_REPO)).exists() else "github",
            force_reload=FORCE_RELOAD_YOLOV5,
        )
        model.conf = CONF
        model.iou = IOU
        model.to(DEVICE)
        return model

    raise ValueError("BACKEND musi być 'ultralytics' albo 'yolov5'")


def load_single_classifier(checkpoint_path: str):
    checkpoint_path = Path(checkpoint_path)
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Nie znaleziono classifiera: {checkpoint_path}")

    ckpt = torch.load(str(checkpoint_path), map_location=DEVICE)
    classes = ckpt["classes"]

    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, len(classes))
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(DEVICE)
    model.eval()

    return model, classes


def load_classifiers():
    classifiers = {}
    for asset_name, ckpt_path in CLASSIFIER_PATHS.items():
        try:
            model, classes = load_single_classifier(ckpt_path)
            classifiers[asset_name] = {
                "model": model,
                "classes": classes,
            }
            print(f"[OK] classifier loaded: {asset_name} -> classes={classes}")
        except Exception as e:
            print(f"[WARN] Nie udało się wczytać classifiera dla {asset_name}: {e}")
    return classifiers


def classify_crop(crop_bgr: np.ndarray, asset_name: str, classifiers: dict):
    if asset_name not in classifiers:
        return None, None

    if crop_bgr is None or crop_bgr.size == 0:
        return None, None

    crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(crop_rgb)
    x = CLS_TRANSFORM(pil_img).unsqueeze(0).to(DEVICE)

    model = classifiers[asset_name]["model"]
    classes = classifiers[asset_name]["classes"]

    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1)
        pred_idx = int(torch.argmax(probs, dim=1).item())
        pred_conf = float(probs[0, pred_idx].item())

    label = classes[pred_idx]
    return label, pred_conf


def draw_fps(image: np.ndarray, fps: float) -> np.ndarray:
    cv2.putText(
        image,
        f"FPS: {fps:.1f} | backend: {BACKEND}",
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (0, 255, 0),
        2,
        cv2.LINE_AA,
    )
    return image


def draw_box_with_label(image, x1, y1, x2, y2, label, color=(0, 255, 0)):
    cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)

    (text_w, text_h), baseline = cv2.getTextSize(
        label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2
    )

    box_top = max(0, y1 - text_h - baseline - 8)
    box_bottom = max(0, y1)
    box_right = min(image.shape[1], x1 + text_w + 10)

    cv2.rectangle(
        image,
        (x1, box_top),
        (box_right, box_bottom),
        color,
        thickness=-1
    )

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


# =========================
# INFERENCJA
# =========================
def predict_frame(model, classifiers: dict, frame: np.ndarray) -> np.ndarray:
    annotated = frame.copy()

    if BACKEND == "ultralytics":
        results = model.predict(
            source=frame,
            conf=CONF,
            iou=IOU,
            imgsz=IMG_SIZE,
            device=0 if DEVICE.startswith("cuda") else "cpu",
            verbose=False,
        )

        result = results[0]
        names = result.names

        if result.boxes is None:
            return annotated

        img_h, img_w = frame.shape[:2]

        for box in result.boxes:
            cls_id = int(box.cls[0].item())
            det_conf = float(box.conf[0].item())
            asset_name = names[cls_id]

            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            x1, y1, x2, y2 = expand_box(x1, y1, x2, y2, img_w, img_h, CROP_PADDING)

            crop = frame[y1:y2, x1:x2]

            status_label, cls_conf = classify_crop(crop, asset_name, classifiers)

            if status_label is not None and (cls_conf is None or cls_conf >= CLS_CONF_THRESHOLD):
                final_label = f"{asset_name} | {status_label}"
                color = (0, 255, 0) if status_label == "good" else (0, 165, 255)
            else:
                final_label = f"{asset_name}"
                color = (255, 255, 0)

            draw_box_with_label(annotated, x1, y1, x2, y2, final_label, color=color)

        return annotated

    if BACKEND == "yolov5":
        # Dla yolov5 torch.hub też można to zrobić, ale ponieważ używasz ultralytics,
        # zostawiam prosty fallback na stary render.
        results = model(frame, size=IMG_SIZE)
        rendered = results.render()
        annotated = rendered[0].copy()
        return annotated

    raise ValueError("Nieobsługiwany backend")


# =========================
# MAIN
# =========================
def main():
    print(f"Ładowanie YOLO backend={BACKEND}, device={DEVICE}...")
    model = load_model()

    print("Ładowanie classifierów...")
    classifiers = load_classifiers()

    with mss() as sct:
        area = get_capture_area(sct, MONITOR_INDEX, CAPTURE_REGION)
        print("Przechwytywany obszar:", area)
        print("Naciśnij Q, aby wyjść.")

        prev_time = time.perf_counter()

        while True:
            sct_img = sct.grab(area)
            frame = np.array(sct_img)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

            annotated = predict_frame(model, classifiers, frame)

            if SHOW_FPS:
                current_time = time.perf_counter()
                fps = 1.0 / max(current_time - prev_time, 1e-6)
                prev_time = current_time
                annotated = draw_fps(annotated, fps)

            cv2.imshow(WINDOW_NAME, annotated)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()