"""
Lap Model

Represents lap-by-lap timing data for each driver in a session.
Contains sector times, speed traps, tyre info, and track status per lap.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    ForeignKey,
    UniqueConstraint,
    Index,
    Computed,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Lap(Base):
    """
    Represents a single lap completed by a driver in a session.

    Each session can have ~1000 laps total (20 drivers × 50 laps average).
    This is the largest table by row count, storing detailed timing data.

    Fields correspond to FastF1's Laps object columns:
    https://docs.fastf1.dev/core.html#fastf1.core.Laps
    """

    __tablename__ = "laps"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    session_id = Column(
        Integer,
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    driver_id = Column(
        Integer,
        ForeignKey("drivers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Lap identification
    lap_number = Column(Integer, nullable=False)  # 1, 2, 3, ... 50+

    # Timing data (all in seconds)
    lap_time_seconds = Column(
        Float, nullable=True
    )  # Total lap time (NULL for in/out laps)
    sector1_time_seconds = Column(Float, nullable=True)
    sector2_time_seconds = Column(Float, nullable=True)
    sector3_time_seconds = Column(Float, nullable=True)

    # Session timestamps (seconds since session start)
    lap_start_time_seconds = Column(Float, nullable=True)  # When lap started
    sector1_session_time_seconds = Column(Float, nullable=True)  # When S1 completed
    sector2_session_time_seconds = Column(Float, nullable=True)  # When S2 completed
    sector3_session_time_seconds = Column(Float, nullable=True)  # When S3 completed

    # Pit stop data
    pit_in_time_seconds = Column(Float, nullable=True)  # Session time when entered pits
    pit_out_time_seconds = Column(Float, nullable=True)  # Session time when exited pits
    pit_duration_seconds = Column(
        Float, Computed("(pit_out_time_seconds - pit_in_time_seconds)"), nullable=True
    )  # Auto-calculated by DB
    stint = Column(Integer, nullable=True)  # Stint number (1, 2, 3, ...)

    # Speed traps (km/h)
    speed_i1 = Column(Float, nullable=True)  # Intermediate 1 speed trap
    speed_i2 = Column(Float, nullable=True)  # Intermediate 2 speed trap
    speed_fl = Column(Float, nullable=True)  # Finish line speed
    speed_st = Column(Float, nullable=True)  # Speed trap

    # Tyre data
    compound = Column(
        String(15), nullable=True
    )  # SOFT, MEDIUM, HARD, INTERMEDIATE, WET
    tyre_life = Column(Integer, nullable=True)  # Laps on this set of tyres
    fresh_tyre = Column(Boolean, nullable=True)  # Is this a new tyre set?

    # Position and flags
    position = Column(Integer, nullable=True)  # Track position after this lap
    track_status = Column(
        String(10), nullable=True
    )  # Track status during lap (1=green, 2=yellow, etc.)
    is_personal_best = Column(Boolean, nullable=True)  # Driver's personal best lap
    is_accurate = Column(Boolean, nullable=True)  # FastF1 accuracy flag

    # FIA deletions (track limits violations)
    deleted = Column(Boolean, nullable=True)  # Was this lap time deleted by FIA?
    deleted_reason = Column(String(100), nullable=True)  # Reason for deletion

    # Relationships
    session = relationship("Session", back_populates="laps")
    driver = relationship("Driver", back_populates="laps")

    # Constraints
    __table_args__ = (
        # Each driver can only have one lap per lap number per session
        UniqueConstraint(
            "session_id", "driver_id", "lap_number", name="uq_session_driver_lap"
        ),
        # Optimize for common query patterns
        Index(
            "idx_session_lap_number", "session_id", "lap_number"
        ),  # Lap-by-lap progression
        Index(
            "idx_session_driver", "session_id", "driver_id"
        ),  # Driver-specific queries
    )

    def __repr__(self):
        """String representation for debugging"""
        return f"<Lap session_id={self.session_id} driver_id={self.driver_id} lap={self.lap_number}>"
