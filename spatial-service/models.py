import uuid
from sqlalchemy import Column, String, Float, DateTime, func
from geoalchemy2 import Geometry
from database import Base


class IssueReport(Base):
    """SQLAlchemy model mirroring the NestJS-managed issue_reports table."""

    __tablename__ = "issue_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reporter_id = Column(String, nullable=True)
    category = Column(String, default="Uncategorized")
    severity = Column(String, default="Minor")
    status = Column(String, default="Reported")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    geo_location = Column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=True,
    )
    s3_media_url = Column(String, nullable=True)
    original_media_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
