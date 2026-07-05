import uuid
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from spatial import check_duplicate_within_radius, get_reports_nearby
from storage import upload_file, ensure_bucket_exists

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_report(
    latitude: float = Form(..., description="GPS latitude of the issue"),
    longitude: float = Form(..., description="GPS longitude of the issue"),
    reporter_id: Optional[str] = Form(None, description="Authenticated user ID"),
    media: Optional[UploadFile] = File(None, description="Photo or video evidence"),
    db: AsyncSession = Depends(get_db),
):
    """
    Task 3.3 — Create a new issue report.

    Flow:
    1. Run spatial duplication check (50m radius).
    2. Upload raw media to MinIO (original_media_url).
    3. Insert report into PostgreSQL with PostGIS point.
    4. Return report details + duplicate warning if applicable.
    """
    # Step 1 — Duplication check
    duplicate = await check_duplicate_within_radius(db, latitude, longitude)
    duplicate_warning = None
    if duplicate:
        duplicate_warning = {
            "message": "A similar issue has already been reported nearby.",
            "existing_id": duplicate["id"],
            "category": duplicate["category"],
            "status": duplicate["status"],
        }

    # Step 2 — Upload raw media if provided
    original_media_url = None
    if media:
        ensure_bucket_exists()
        file_bytes = await media.read()
        ext = media.filename.rsplit(".", 1)[-1] if "." in media.filename else "jpg"
        object_key = f"raw/{uuid.uuid4()}.{ext}"
        original_media_url = upload_file(file_bytes, object_key, media.content_type or "image/jpeg")

    # Step 3 — Insert report with PostGIS geo_location point
    report_id = str(uuid.uuid4())
    insert_query = text(
        """
        INSERT INTO issue_reports
            (id, reporter_id, category, severity, status,
             latitude, longitude, geo_location, original_media_url, created_at)
        VALUES
            (:id, :reporter_id, :category, :severity, :status,
             :lat, :lon,
             ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
             :original_media_url, :created_at)
        RETURNING id, category, severity, status, created_at
        """
    )
    result = await db.execute(
        insert_query,
        {
            "id": report_id,
            "reporter_id": reporter_id,
            "category": "Uncategorized",  # AI worker will update this async
            "severity": "Minor",
            "status": "Reported",
            "lat": latitude,
            "lon": longitude,
            "original_media_url": original_media_url,
            "created_at": datetime.utcnow(),
        },
    )
    await db.commit()
    row = result.fetchone()

    response = {
        "id": row.id,
        "category": row.category,
        "severity": row.severity,
        "status": row.status,
        "latitude": latitude,
        "longitude": longitude,
        "original_media_url": original_media_url,
        "created_at": row.created_at.isoformat(),
        "duplicate_warning": duplicate_warning,
    }
    return response


@router.get("/nearby")
async def reports_nearby(
    lat: float = Query(..., description="Center latitude"),
    lon: float = Query(..., description="Center longitude"),
    radius: int = Query(2000, description="Search radius in metres (default 2000 m)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (Reported, Verified, Resolved)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Task 3.4 — Return all issue reports within a given radius, sorted by distance.
    Powered by PostGIS ST_DWithin with GIST spatial index.
    """
    reports = await get_reports_nearby(db, lat, lon, radius, status_filter)
    return {"count": len(reports), "reports": reports}


@router.get("/{report_id}")
async def get_report(report_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch a single report by UUID."""
    result = await db.execute(
        text("SELECT * FROM issue_reports WHERE id = :id"),
        {"id": report_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return dict(row._mapping)
