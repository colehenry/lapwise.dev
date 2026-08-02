"""
Pit Stop Model

One row per completed pit stop, with the stationary duration as a single value.

Separate from `laps` because FastF1 splits a stop across two lap rows (PitInTime
on the in-lap, PitOutTime on the out-lap), so no single lap row holds a stop.
Jolpica supplies the duration directly for 2011-2017 but no session-relative
timeline at all.
"""

from sqlalchemy import (
    Column,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class PitStop(Base):
    """A single pit stop by one driver in one session."""

    __tablename__ = "pit_stops"

    id = Column(Integer, primary_key=True, index=True)

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

    lap_number = Column(Integer, nullable=False)  # Lap the driver entered the pits on
    stop_number = Column(Integer, nullable=False)  # 1, 2, 3, ... within the session

    # Pit lane time (entry to exit), not stationary time in the box. Averages
    # ~24s; red-flagged stops run into the hundreds.
    duration_seconds = Column(Float, nullable=True)
    local_time = Column(Time, nullable=True)  # Local time of day (Jolpica only)

    source = Column(String(20), nullable=False)  # 'fastf1' or 'jolpica'

    session = relationship("Session", back_populates="pit_stops")
    driver = relationship("Driver", back_populates="pit_stops")

    __table_args__ = (
        UniqueConstraint(
            "session_id", "driver_id", "stop_number", name="uq_session_driver_stop"
        ),
        Index("idx_pit_session_lap", "session_id", "lap_number"),
    )

    def __repr__(self):
        return (
            f"<PitStop session_id={self.session_id} driver_id={self.driver_id} "
            f"stop={self.stop_number} {self.duration_seconds}s>"
        )
