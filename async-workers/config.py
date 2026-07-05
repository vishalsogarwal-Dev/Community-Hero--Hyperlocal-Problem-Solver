import os
from dotenv import load_dotenv

load_dotenv()

# Broker & Backend
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")
CELERY_BROKER_URL = RABBITMQ_URL
CELERY_RESULT_BACKEND = REDIS_URL

# Database (PostgreSQL)
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USERNAME = os.getenv("DB_USERNAME", "hero_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "hero_password")
DB_DATABASE = os.getenv("DB_DATABASE", "community_hero")
DB_URL = f"postgresql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_DATABASE}"

# MinIO / S3
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost")
MINIO_PORT = int(os.getenv("MINIO_PORT", "9000"))
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minio_admin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minio_password")
MINIO_BUCKET_NAME = os.getenv("MINIO_BUCKET_NAME", "community-hero-media")
MINIO_USE_SSL = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
MINIO_URL = f"{'https' if MINIO_USE_SSL else 'http'}://{MINIO_ENDPOINT}:{MINIO_PORT}"

# WebSocket notification endpoint (NestJS core)
CORE_WS_NOTIFY_URL = os.getenv("CORE_WS_NOTIFY_URL", "http://localhost:3000/internal/notify")
