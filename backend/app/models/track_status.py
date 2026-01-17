"""
Track Status Model

Represents track condition changes during a session.
Tracks safety car deployments, yellow flags, red flags, etc.
"""

from sqlalchemy import Column, Integer, String, Float, ForeignKey, Index, Text
from sqlalchemy.orm import relationship

from app.database import Base


class TrackStatus(Base):
    """
    Represents track status changes during a session.

    Track status changes when flags are deployed, safety car comes out, etc.
    A typical session might have 5-20 status changes.

    Status codes from FastF1:
    - "1" = Green flag / Clear track
    - "2" = Yellow flag
    - "4" = Safety Car (SC)
    - "5" = Red flag
    - "6" = Virtual Safety Car (VSC)
    - "7" = VSC ending

    Fields correspond to FastF1's track_status DataFrame:
    https://docs.fastf1.dev/core.html#fastf1.core.Session.track_status
    """

    __tablename__ = "track_status"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Foreign key
    session_id = Column(
        Integer,
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Timestamp (seconds since session start)
    session_time_seconds = Column(Float, nullable=False)

    # Status information
    status = Column(
        String(10), nullable=False
    )  # Status code ("1", "2", "4", "5", "6", "7")
    message = Column(Text, nullable=True)  # Human-readable message from FastF1

    # Relationships
    session = relationship("Session", back_populates="track_status")

    # Constraints
    __table_args__ = (
        # Optimize for time-based queries (get status at time, status changes during range)
        Index("idx_session_time", "session_id", "session_time_seconds"),
    )

    def __repr__(self):
        """String representation for debugging"""
        return f"<TrackStatus session_id={self.session_id} time={self.session_time_seconds}s status={self.status}>"
