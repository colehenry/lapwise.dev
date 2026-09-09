"""Owned driver media: immutable source files and their driver-season assignments."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import text as sql_text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

RIGHTS_STATUSES = ("pending", "approved", "restricted", "removed")
MEDIA_ROLES = ("headshot", "portrait", "banner")
VISUAL_GRADES = ("studio", "clean", "acceptable", "poor")


class MediaAsset(Base):
    """One immutable source file in owned storage, keyed by content hash."""

    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True)
    storage_key = Column(String, nullable=False, unique=True)
    sha256 = Column(String(64), nullable=False, unique=True)
    mime_type = Column(String(60), nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)

    source_provider = Column(String(60), nullable=False)
    source_url = Column(Text, nullable=False)
    author_name = Column(String, nullable=True)
    author_url = Column(Text, nullable=True)
    license_code = Column(String(60), nullable=False)
    license_url = Column(Text, nullable=True)
    attribution_text = Column(Text, nullable=False)

    rights_status = Column(String(20), nullable=False, server_default="pending")
    ingested_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    removed_at = Column(DateTime(timezone=True), nullable=True)

    assignments = relationship(
        "DriverMediaAssignment", back_populates="asset", passive_deletes=True
    )

    __table_args__ = (
        CheckConstraint(
            "rights_status IN ('pending', 'approved', 'restricted', 'removed')",
            name="ck_media_asset_rights_status",
        ),
        CheckConstraint("width > 0 AND height > 0", name="ck_media_asset_dimensions"),
        Index("idx_media_asset_rights", "rights_status"),
    )


class DriverMediaAssignment(Base):
    """Assigns an approved asset to a driver, optionally scoped to one season."""

    __tablename__ = "driver_media_assignments"

    id = Column(Integer, primary_key=True)
    driver_id = Column(
        Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False
    )
    year = Column(Integer, nullable=True)
    role = Column(String(20), nullable=False)
    media_asset_id = Column(
        Integer, ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=False
    )

    focal_x = Column(Float, nullable=True)
    focal_y = Column(Float, nullable=True)
    visual_grade = Column(String(20), nullable=False, server_default="acceptable")

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    asset = relationship("MediaAsset", back_populates="assignments")

    __table_args__ = (
        # A season-scoped row must name a real driver-season. MATCH SIMPLE lets
        # the career-wide fallback through, since its year is NULL.
        ForeignKeyConstraint(
            ["driver_id", "year"],
            ["driver_seasons.driver_id", "driver_seasons.year"],
            name="fk_driver_media_season",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "role IN ('headshot', 'portrait', 'banner')",
            name="ck_driver_media_role",
        ),
        CheckConstraint(
            "visual_grade IN ('studio', 'clean', 'acceptable', 'poor')",
            name="ck_driver_media_visual_grade",
        ),
        CheckConstraint(
            "(focal_x IS NULL OR (focal_x >= 0 AND focal_x <= 1))"
            " AND (focal_y IS NULL OR (focal_y >= 0 AND focal_y <= 1))",
            name="ck_driver_media_focal_range",
        ),
        Index(
            "uq_driver_media_season",
            "driver_id",
            "year",
            "role",
            unique=True,
            postgresql_where=sql_text("year IS NOT NULL"),
        ),
        Index(
            "uq_driver_media_fallback",
            "driver_id",
            "role",
            unique=True,
            postgresql_where=sql_text("year IS NULL"),
        ),
        Index("idx_driver_media_lookup", "role", "year", "driver_id"),
    )
