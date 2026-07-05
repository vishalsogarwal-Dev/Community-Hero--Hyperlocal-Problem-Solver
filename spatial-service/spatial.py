from typing import Optional, List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


DUPLICATE_RADIUS_METERS = 50


async def check_duplicate_within_radius(
    db: AsyncSession,
    latitude: float,
    longitude: float,
    radius_m: int = DUPLICATE_RADIUS_METERS,
) -> Optional[dict]:
    """
    Task 3.2 — Spatial Duplication Check using ST_DWithin.

    Returns the first existing report within `radius_m` metres of the given
    coordinates that is still in 'Reported' or 'Verified' status, or None.
    """
    query = text(
        """
        SELECT id, category, status, ST_AsText(geo_location) AS location
        FROM issue_reports
        WHERE ST_DWithin(
            geo_location::geography,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
            :radius
        )
        AND status IN ('Reported', 'Verified')
        LIMIT 1
        """
    )
    result = await db.execute(query, {"lat": latitude, "lon": longitude, "radius": radius_m})
    row = result.fetchone()
    if row:
        return {"id": row.id, "category": row.category, "status": row.status, "location": row.location}
    return None


async def get_reports_nearby(
    db: AsyncSession,
    latitude: float,
    longitude: float,
    radius_m: int = 2000,
    status_filter: Optional[str] = None,
) -> List[dict]:
    """
    Task 3.4 — Spatial search: return all reports within radius_m of the given point.
    Optionally filter by status.  Uses a GIST spatial index for performance.
    """
    status_clause = "AND status = :status" if status_filter else ""
    query = text(
        f"""
        SELECT
            id,
            reporter_id,
            category,
            severity,
            status,
            latitude,
            longitude,
            s3_media_url,
            original_media_url,
            created_at,
            ST_Distance(
                geo_location::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
            ) AS distance_m
        FROM issue_reports
        WHERE ST_DWithin(
            geo_location::geography,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
            :radius
        )
        {status_clause}
        ORDER BY distance_m ASC
        """
    )
    params = {"lat": latitude, "lon": longitude, "radius": radius_m}
    if status_filter:
        params["status"] = status_filter
    result = await db.execute(query, params)
    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]
