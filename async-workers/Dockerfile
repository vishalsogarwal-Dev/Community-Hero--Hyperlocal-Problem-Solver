FROM python:3.12-slim

# Install build dependencies for psycopg2
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download YOLOv8 nano weights (cached in the image layer)
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

COPY . .

CMD ["celery", "-A", "worker", "worker", "--loglevel=info", "-Q", "ai_pipeline", "--concurrency=1"]
