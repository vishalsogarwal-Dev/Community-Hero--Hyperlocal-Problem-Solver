"""
Task 4.1 — Celery application factory.

Connects to RabbitMQ as the message broker and Redis as the result backend.
"""
from celery import Celery
from config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND

app = Celery(
    "community_hero_workers",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=[
        "tasks.anonymize",
        "tasks.categorize",
    ],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,  # One task at a time for GPU-heavy inference
    task_routes={
        "tasks.anonymize.*": {"queue": "ai_pipeline"},
        "tasks.categorize.*": {"queue": "ai_pipeline"},
    },
)
