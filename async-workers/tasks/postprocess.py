"""
Task 4.4 — Post-Processing: Persist AI Results & Trigger WebSocket Notification.

After anonymization + categorization complete, this task:
1. Writes the AI-generated category, severity, and public media URL back to
   the issue_reports table in PostgreSQL.
2. Updates the report status to 'Reported' (AI processing complete).
3. Posts a notification payload to the NestJS Core service's internal endpoint,
   which broadcasts a WebSocket event to connected clients.
"""
import logging
import psycopg2
import httpx

from worker import app
from config import DB_URL, CORE_WS_NOTIFY_URL

logger = logging.getLogger(__name__)


@app.task(bind=True, name="tasks.postprocess.update_report_and_notify", max_retries=3, default_retry_delay=10)
def update_report_and_notify(
    self,
    report_id: str,
    category: str,
    severity: str,
    s3_media_url: str,
) -> dict:
    """
    Celery task that persists AI results and fires a WebSocket event.
    """
    try:
        # Step 1 — Update PostgreSQL via psycopg2 (synchronous, fine for a worker)
        conn = psycopg2.connect(DB_URL)
        conn.autocommit = False
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE issue_reports
            SET category = %s,
                severity = %s,
                s3_media_url = %s,
                status = 'Reported'
            WHERE id = %s
            """,
            (category, severity, s3_media_url, report_id),
        )
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"[postprocess] DB updated for report_id={report_id}")

        # Step 2 — Notify the NestJS Core service to push a WebSocket event
        payload = {
            "event": "REPORT_AI_PROCESSED",
            "report_id": report_id,
            "category": category,
            "severity": severity,
            "s3_media_url": s3_media_url,
        }
        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(CORE_WS_NOTIFY_URL, json=payload)
            logger.info(f"[postprocess] WebSocket notification sent for report_id={report_id}")
        except Exception as ws_exc:
            # Non-fatal: DB already updated; log and continue
            logger.warning(f"[postprocess] WebSocket notify failed (non-fatal): {ws_exc}")

        return {"report_id": report_id, "status": "Reported", "category": category, "severity": severity}

    except Exception as exc:
        logger.error(f"[postprocess] Error for report_id={report_id}: {exc}")
        raise self.retry(exc=exc)
