"""Rebuildable career aggregates behind the all-time archive listings.

These tables are derived data: never hand-edited, always reproducible from
session results and canonical identity, and refreshed after ingestion.
"""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.sql import func

from app.database import Base


class AggDriverCareer(Base):
    """One row per driver per sprint-inclusion variant."""

    __tablename__ = "agg_driver_career"

    driver_id = Column(
        Integer,
        ForeignKey("drivers.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # Sprint results count toward the totals when true; the archive listing
    # offers both, so both are materialized.
    include_sprint = Column(Boolean, primary_key=True)

    driver_code = Column(String, nullable=True)
    driver_slug = Column(String, nullable=True)
    full_name = Column(String, nullable=False)
    country_code = Column(String, nullable=True)
    headshot_url = Column(String, nullable=True)
    total_wins = Column(Integer, nullable=False, server_default="0")
    total_races = Column(Integer, nullable=False, server_default="0")
    total_podiums = Column(Integer, nullable=False, server_default="0")
    total_points = Column(Float, nullable=False, server_default="0")
    current_team = Column(String, nullable=True)
    current_team_color = Column(String, nullable=True)
    first_season = Column(Integer, nullable=True)
    latest_season = Column(Integer, nullable=True)
    refreshed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index(
            "idx_agg_driver_career_order",
            "include_sprint",
            "total_wins",
            "total_points",
        ),
    )


class AggConstructorCareer(Base):
    """One row per canonical constructor per sprint-inclusion variant."""

    __tablename__ = "agg_constructor_career"

    constructor_id = Column(
        Integer,
        ForeignKey("constructors.id", ondelete="CASCADE"),
        primary_key=True,
    )
    include_sprint = Column(Boolean, primary_key=True)

    team_name = Column(String, nullable=False)
    constructor_slug = Column(String, nullable=True)
    team_color = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    total_wins = Column(Integer, nullable=False, server_default="0")
    total_races = Column(Integer, nullable=False, server_default="0")
    total_podiums = Column(Integer, nullable=False, server_default="0")
    total_points = Column(Float, nullable=False, server_default="0")
    first_season = Column(Integer, nullable=True)
    latest_season = Column(Integer, nullable=True)
    refreshed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index(
            "idx_agg_constructor_career_order",
            "include_sprint",
            "total_wins",
            "total_points",
        ),
    )
