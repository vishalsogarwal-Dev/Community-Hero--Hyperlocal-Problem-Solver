"""
Task 4.2 — YOLOv8-based Privacy Anonymization Worker.

Downloads uploaded raw media from MinIO, detects human faces and vehicle
license plates using YOLOv8, applies Gaussian blur to all detected bounding
boxes, and re-uploads the anonymized file to the public path in MinIO.
"""
import io
import uuid
import logging

import boto3
import botocore
from botocore.client import Config
from PIL import Image, ImageFilter
from ultralytics import YOLO

from worker import app
from config import (
    MINIO_URL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY,
    MINIO_BUCKET_NAME, MINIO_USE_SSL,
)

logger = logging.getLogger(__name__)

# ── Model loading (cached across task invocations in the same worker process) ─
_yolo_model: YOLO | None = None


def _get_model() -> YOLO:
    global _yolo_model
    if _yolo_model is None:
        # YOLOv8n is nano — fastest & lightest, suitable for CPU workers
        _yolo_model = YOLO("yolov8n.pt")
    return _yolo_model


# ── MinIO / S3 helper ─────────────────────────────────────────────────────────

def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=MINIO_URL,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def _download_bytes(object_key: str) -> bytes:
    client = _s3_client()
    response = client.get_object(Bucket=MINIO_BUCKET_NAME, Key=object_key)
    return response["Body"].read()


def _upload_bytes(data: bytes, object_key: str, content_type: str = "image/jpeg") -> str:
    client = _s3_client()
    client.put_object(
        Bucket=MINIO_BUCKET_NAME,
        Key=object_key,
        Body=data,
        ContentType=content_type,
    )
    return f"{MINIO_URL}/{MINIO_BUCKET_NAME}/{object_key}"


# ── Privacy anonymization logic ───────────────────────────────────────────────

BLUR_CLASSES = {
    0,   # person  → blur face region (upper third of bbox)
    2,   # car
    3,   # motorcycle
    5,   # bus
    7,   # truck
}
BLUR_RADIUS = 20


def _blur_pil_region(img: Image.Image, x1: int, y1: int, x2: int, y2: int) -> Image.Image:
    """Gaussian-blur a rectangular region inside a PIL image."""
    region = img.crop((x1, y1, x2, y2))
    blurred = region.filter(ImageFilter.GaussianBlur(radius=BLUR_RADIUS))
    img.paste(blurred, (x1, y1))
    return img


@app.task(bind=True, name="tasks.anonymize.anonymize_media", max_retries=3, default_retry_delay=10)
def anonymize_media(self, report_id: str, raw_object_key: str) -> dict:
    """
    Celery task that:
    1. Downloads raw image from MinIO.
    2. Runs YOLOv8 detection to find faces / license-plate regions.
    3. Blurs detected regions using Gaussian blur.
    4. Uploads the anonymized image to public/ path in MinIO.
    5. Returns {'anonymized_url': ..., 'report_id': ...} for the next task.
    """
    try:
        logger.info(f"[anonymize] Starting for report_id={report_id}, key={raw_object_key}")

        # Step 1 — download raw media
        raw_bytes = _download_bytes(raw_object_key)
        img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")

        # Step 2 — YOLOv8 inference
        model = _get_model()
        results = model.predict(img, conf=0.35, verbose=False)

        # Step 3 — blur detected bounding boxes
        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0].item())
                if cls_id not in BLUR_CLASSES:
                    continue
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                if cls_id == 0:
                    # For persons: only blur the upper-third (likely face)
                    face_bottom = y1 + (y2 - y1) // 3
                    img = _blur_pil_region(img, x1, y1, x2, face_bottom)
                else:
                    # For vehicles: blur the entire licence-plate zone (bottom strip)
                    plate_top = y1 + int((y2 - y1) * 0.75)
                    img = _blur_pil_region(img, x1, plate_top, x2, y2)

        # Step 4 — re-encode & upload
        ext = raw_object_key.rsplit(".", 1)[-1]
        public_key = f"public/{report_id}/{uuid.uuid4()}.{ext}"
        buf = io.BytesIO()
        fmt = "JPEG" if ext.lower() in ("jpg", "jpeg") else "PNG"
        img.save(buf, format=fmt, quality=90)
        anonymized_url = _upload_bytes(buf.getvalue(), public_key, f"image/{ext.lower()}")

        logger.info(f"[anonymize] Done → {anonymized_url}")
        return {"report_id": report_id, "anonymized_url": anonymized_url, "public_key": public_key}

    except Exception as exc:
        logger.error(f"[anonymize] Error for report_id={report_id}: {exc}")
        raise self.retry(exc=exc)
