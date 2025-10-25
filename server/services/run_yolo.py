#!/usr/bin/env python
import sys
import json
import time

def fallback_output(message=None):
    out = {"predictions": [], "image": {"width": 640, "height": 480}, "processing_time": 0}
    if message:
        out["error"] = str(message)
    print(json.dumps(out))
    sys.exit(0)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        fallback_output("Usage: run_yolo.py <image_path> <model_path>")

    image_path = sys.argv[1]
    model_path = sys.argv[2]

    try:
        from ultralytics import YOLO
    except Exception as e:
        # ultralytics not installed, fallback
        fallback_output(f"ultralytics import error: {e}")

    try:
        start = time.time()
        model = YOLO(model_path)
        # Run a single prediction
        results = model.predict(source=image_path, imgsz=640, conf=0.25, verbose=False)

        # results is iterable, take first
        if len(results) == 0:
            processing_time = int((time.time() - start) * 1000)
            print(json.dumps({"predictions": [], "image": {"width": 640, "height": 480}, "processing_time": processing_time}))
            sys.exit(0)

        r = results[0]

        preds = []
        # r.boxes.xyxy, r.boxes.conf, r.boxes.cls
        boxes = getattr(r, 'boxes', None)
        if boxes is not None:
            # boxes.xyxy is a tensor-like; convert to list if possible
            try:
                xyxy = boxes.xyxy.tolist()
                confs = boxes.conf.tolist()
                clss = boxes.cls.tolist()
            except Exception:
                # Fallback if attributes differ
                xyxy = []
                confs = []
                clss = []

            for i, box in enumerate(xyxy):
                x1, y1, x2, y2 = box
                w = x2 - x1
                h = y2 - y1
                cx = x1 + w / 2
                cy = y1 + h / 2
                conf = confs[i] if i < len(confs) else 0.0
                cls = int(clss[i]) if i < len(clss) else -1
                name = str(cls)
                # If model.names exists, map class id to name
                try:
                    names = model.names if hasattr(model, 'names') else None
                    if names and cls in names:
                        name = names[cls]
                except Exception:
                    pass

                preds.append({
                    "class": name,
                    "confidence": float(conf),
                    "x": float(cx),
                    "y": float(cy),
                    "width": float(w),
                    "height": float(h),
                    "bbox": {"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2)}
                })

        processing_time = int((time.time() - start) * 1000)

        # Determine original image shape (height, width) if available
        try:
            if hasattr(r, 'orig_shape') and r.orig_shape:
                orig_h, orig_w = r.orig_shape[0], r.orig_shape[1]
            else:
                orig_h, orig_w = 480, 640
        except Exception:
            orig_h, orig_w = 480, 640

        out = {
            "predictions": preds,
            "image": {"width": int(orig_w), "height": int(orig_h)},
            "processing_time": processing_time,
        }

        print(json.dumps(out))
    except Exception as e:
        fallback_output(str(e))
