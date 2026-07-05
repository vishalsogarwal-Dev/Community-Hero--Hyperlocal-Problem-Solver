"""
Task 4.3 — Multi-label Issue Categorization Worker.

Classifies the anonymized image into a civic issue category
(Pothole, Waste, Water Leak, Broken Infrastructure, Graffiti, Other)
and estimates severity (Minor / Medium / Severe) based on visual heuristics.

Uses a lightweight MobileNetV3 backbone loaded from torchvision and fine-tuned
label mapping.  On a CPU worker this runs comfortably within a few seconds.
"""
import io
import logging
from typing import Tuple

import torch
import torchvision.transforms as T
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
from PIL import Image

from worker import app
from tasks.postprocess import update_report_and_notify

logger = logging.getLogger(__name__)

# ── Category & severity definitions ──────────────────────────────────────────

# ImageNet classes that map to our civic issue categories.
# MobileNetV3-Small was trained on ImageNet-1k; we use keyword matching on the
# top-5 class names as a zero-shot heuristic until a fine-tuned model is ready.
CATEGORY_KEYWORDS = {
    "Pothole": ["pavement", "asphalt", "road", "highway", "street", "crack", "pothole"],
    "Waste": ["garbage", "trash", "waste", "litter", "rubbish", "dumpster", "bin"],
    "Water Leak": ["flood", "puddle", "water", "leak", "pipe", "drain", "gutter"],
    "Broken Infrastructure": ["pole", "sign", "signboard", "fence", "wall", "lamp", "light"],
    "Graffiti": ["graffiti", "paint", "vandal", "mural", "spray"],
}

SEVERITY_KEYWORDS = {
    "Severe": ["flood", "sinkhole", "collapse", "dangerous", "broken", "major"],
    "Medium": ["crack", "leak", "damage", "blocked", "pothole", "graffiti"],
}


def _classify_by_keywords(top5_labels: list) -> Tuple[str, str]:
    """Map ImageNet top-5 label strings to our category and severity."""
    labels_lower = " ".join(top5_labels).lower()

    category = "Other"
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in labels_lower for kw in keywords):
            category = cat
            break

    severity = "Minor"
    for sev, keywords in SEVERITY_KEYWORDS.items():
        if any(kw in labels_lower for kw in keywords):
            severity = sev
            break

    return category, severity


# ── Model loading (cached per worker process) ─────────────────────────────────

_model = None
_weights = None


def _get_model():
    global _model, _weights
    if _model is None:
        _weights = MobileNet_V3_Small_Weights.IMAGENET1K_V1
        _model = mobilenet_v3_small(weights=_weights)
        _model.eval()
    return _model, _weights


_transform = T.Compose([
    T.Resize(256),
    T.CenterCrop(224),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


@app.task(bind=True, name="tasks.categorize.categorize_report", max_retries=3, default_retry_delay=10)
def categorize_report(self, report_id: str, anonymized_url: str, public_key: str) -> dict:
    """
    Celery task that:
    1. Downloads the anonymized image from MinIO.
    2. Runs MobileNetV3 inference (ImageNet top-5 labels).
    3. Maps labels to a civic category + severity via keyword heuristic.
    4. Calls the post-processing task to persist results and push WS notification.
    """
    import boto3
    import requests
    from botocore.client import Config
    from config import (
        MINIO_URL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET_NAME,
    )

    try:
        logger.info(f"[categorize] Starting for report_id={report_id}")

        # Download anonymized image
        client = boto3.client(
            "s3",
            endpoint_url=MINIO_URL,
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
        response = client.get_object(Bucket=MINIO_BUCKET_NAME, Key=public_key)
        img_bytes = response["Body"].read()

        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        tensor = _transform(img).unsqueeze(0)

        model, weights = _get_model()
        with torch.no_grad():
            output = model(tensor)

        probabilities = torch.nn.functional.softmax(output[0], dim=0)
        top5_probs, top5_indices = torch.topk(probabilities, 5)
        top5_labels = [weights.meta["categories"][idx] for idx in top5_indices]

        category, severity = _classify_by_keywords(top5_labels)
        confidence = float(top5_probs[0].item())

        logger.info(f"[categorize] report_id={report_id} → category={category}, severity={severity}, confidence={confidence:.2f}")

        # Trigger post-processing (Task 4.4)
        update_report_and_notify.delay(
            report_id=report_id,
            category=category,
            severity=severity,
            s3_media_url=anonymized_url,
        )

        return {
            "report_id": report_id,
            "category": category,
            "severity": severity,
            "confidence": confidence,
            "top5_labels": top5_labels,
        }

    except Exception as exc:
        logger.error(f"[categorize] Error for report_id={report_id}: {exc}")
        raise self.retry(exc=exc)
