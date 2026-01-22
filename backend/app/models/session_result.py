"""
Session Result Model

Represents an individual driver's performance in a specific session.
This table stores results for all session types (race, qualifying, sprint, etc.)
with nullable fields for session-specific data.
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
)
from sqlalchemy.orm import relationship

from app.database import Base


class SessionResult(Base):
    """
    Represents a single driver's result in a session.

    Each session has ~20 results (one per driver). Different session types use
    different fields:
    - Race/Sprint: position, points, time_seconds, fastest_lap, etc.
    - Qualifying: position, q1_time_seconds, q2_time_seconds, q3_time_seconds

    Nullable fields allow one table to handle all session types.
    """

    __tablename__ = "session_results"

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
    team_id = Column(
        Integer, ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False
    )

    # Universal fields (all session types)
    position = Column(Integer, nullable=True)  # Final position (NULL for DNF/DNS)
    status = Column(String, nullable=False)  # "Finished", "DNF", "+1 Lap", etc.

    # Driver headshot URL (stored per session as drivers change teams/gear)
    headshot_url = Column(String, nullable=True)

    # Race/Sprint specific fields (NULL for qualifying)
    grid_position = Column(Integer, nullable=True)  # Starting position
    points = Column(Float, nullable=True)  # Championship points awarded
    laps_completed = Column(Integer, nullable=True)
    time_seconds = Column(
        Float, nullable=True
    )  # Total race time in seconds (e.g., 5535.123)
    fastest_lap = Column(
        Boolean, default=False
    )  # Did this driver get fastest lap bonus?

    # Qualifying specific fields (NULL for race/sprint)
    q1_time_seconds = Column(
        Float, nullable=True
    )  # Q1 time in seconds (e.g., 89.452 for "1:29.452")
    q2_time_seconds = Column(Float, nullable=True)  # Q2 time in seconds
    q3_time_seconds = Column(Float, nullable=True)  # Q3 time in seconds (top 10 only)

    # Relationships
    session = relationship("Session", back_populates="results")
    driver = relationship("Driver", back_populates="session_results")
    team = relationship("Team", back_populates="session_results")

    # Constraints
    __table_args__ = (
        UniqueConstraint("session_id", "driver_id", name="uq_session_driver"),
        Index("idx_session_id", "session_id"),
        Index("idx_driver_id", "driver_id"),
    )

    def __repr__(self):
        """String representation for debugging"""
        return f"<SessionResult session_id={self.session_id} driver_id={self.driver_id} P{self.position}>"
