"""
Race Control Message Model

Represents race control communications including penalties, investigations,
flags, and other official race events.
"""

from sqlalchemy import Column, Integer, String, Float, ForeignKey, Index, Text
from sqlalchemy.orm import relationship

from app.database import Base


class RaceControlMessage(Base):
    """
    Represents a message from race control during a session.

    These messages include:
    - Penalties (time penalties, grid drops)
    - Investigations (noted/under investigation)
    - Flag deployments
    - DRS status changes
    - Car events (retirements, mechanical issues)

    A typical race has 30-50 race control messages.

    Fields correspond to FastF1's race_control_messages DataFrame:
    https://docs.fastf1.dev/core.html#fastf1.core.Session.race_control_messages
    """

    __tablename__ = "race_control_messages"

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

    # Message content
    category = Column(
        String(50), nullable=True
    )  # "Flag", "Drs", "CarEvent", "Other", etc.
    message = Column(Text, nullable=False)  # Full message text
    status = Column(String(50), nullable=True)  # Status field from FastF1

    # Driver/location information (nullable - not all messages are driver-specific)
    driver_number = Column(Integer, nullable=True)  # Racing number of affected driver
    flag = Column(String(20), nullable=True)  # Flag type (if applicable)
    scope = Column(String(20), nullable=True)  # "Track", "Driver", "Sector"
    sector = Column(Integer, nullable=True)  # Sector number (1, 2, or 3)
    lap_number = Column(Integer, nullable=True)  # Lap number when message was issued

    # Relationships
    session = relationship("Session", back_populates="race_control_messages")

    # Constraints
    __table_args__ = (
        # Optimize for time-based and driver-specific queries
        Index("idx_session_time", "session_id", "session_time_seconds"),
        Index(
            "idx_session_driver", "session_id", "driver_number"
        ),  # Driver penalty queries
    )

    def __repr__(self):
        """String representation for debugging"""
        driver_info = f" driver={self.driver_number}" if self.driver_number else ""
        return f"<RaceControlMessage session_id={self.session_id}{driver_info} category={self.category}>"
