# 🧠 YOLO Model Training Summary

This project focuses on training a custom object detection model using the **Ultralytics YOLO** framework. The model was trained on a specialized dataset containing power line components and related infrastructure elements.

---

## ⚙️ Training Configuration

| Parameter      | Value                                  |
| -------------- | -------------------------------------- |
| Model          | `yolo26s.pt`                           |
| Epochs         | 100                                    |
| Image Size     | 640                                    |
| Batch Size     | 8                                      |
| Device         | NVIDIA GeForce RTX 5060 Ti (16GB VRAM) |
| Framework      | Ultralytics YOLOv8 (v8.4.38)           |
| Python / Torch | Python 3.11 / Torch 2.8 (CUDA 12.9)    |

---

## 📊 Dataset Overview

| Metric          | Value |
| --------------- | ----- |
| Total Images    | 2,626 |
| Total Instances | 6,324 |
| Classes         | 18    |

**Included object types:**

* Insulators *(polymer, glass)*
* Shackles
* Dampers
* Yokes
* Spacers
* Tower components

---

## 📈 Training Progress

During the initial epochs, the model showed rapid improvement:

* 📉 Significant drop in classification loss *(~2.5 → ~0.75)*
* 📦 Stabilization of box and DFL losses
* 📊 Gradual increase in precision and recall

Validation metrics improved consistently across epochs, indicating effective learning and good generalization.

---

## 🏁 Final Performance (Best Model)

| Metric           | Score |
| ---------------- | ----- |
| **Precision**    | 0.901 |
| **Recall**       | 0.861 |
| **mAP@0.5**      | 0.883 |
| **mAP@0.5:0.95** | 0.737 |

---

## 🔍 Class-wise Highlights

### ✅ Excellent performance *(mAP50 > 0.95)*

* polymer insulator
* tower id plate
* vari-grip
* lightning rod suspension
* spiral damper

### ⚖️ Moderate performance

* yoke
* spacer
* lightning rod shackle

### ⚠️ Challenging classes

* glass insulator shackles *(small / big / tower variants)*
  → likely due to **lower recall** and **small object size**

---

## ⚡ Inference Performance

* **Preprocess:** ~1.0 ms/image
* **Inference:** ~2.6 ms/image
* **Postprocess:** ~0.2 ms/image

➡️ Lightweight model (~9.5M parameters), suitable for **real-time applications**

---

## 💾 Output

```
runs/detect/train3_ft1_safe/weights/best.pt
```

---

## 🚀 Conclusion

The model achieves strong detection performance across most classes, especially for larger and well-represented objects. Some smaller or underrepresented classes remain challenging, suggesting potential improvements through:

* dataset balancing
* additional training samples
* targeted data augmentation

Overall, the model offers a solid balance between **accuracy ⚖️** and **speed ⚡**, making it suitable for deployment in real-time inspection systems.

---
