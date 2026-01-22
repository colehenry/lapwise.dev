"""
Session Model

Represents a specific F1 session (race, qualifying, sprint, etc.).
Replaces the previous 'races' table with a more flexible structure that
supports all session types (race, sprint_race, qualifying, sprint_qualifying).
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Session(Base):
    """
    Represents a Formula 1 session.

    Sessions are grouped by year and round number. Each race weekend (round)
    can have multiple sessions: qualifying, race, and optionally sprint_qualifying
    and sprint_race.

    Examples:
    - 2024, Round 1, 'qualifying' - Bahrain GP Qualifying
    - 2024, Round 1, 'race' - Bahrain GP Race
    - 2024, Round 4, 'sprint_qualifying' - Japanese GP Sprint Qualifying
    - 2024, Round 4, 'sprint_race' - Japanese GP Sprint Race
    """

    __tablename__ = "sessions"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Session identification
    year = Column(Integer, nullable=False, index=True)  # 2024, 2023, etc.
    round = Column(Integer, nullable=False)  # 1, 2, 3, ... 24
    session_type = Column(
        String, nullable=False
    )  # 'race', 'sprint_race', 'qualifying', 'sprint_qualifying'

    # Event metadata
    event_name = Column(String, nullable=False)  # "Bahrain Grand Prix"
    date = Column(Date, nullable=False)  # Session date

    # Foreign key to circuits table
    circuit_id = Column(
        Integer, ForeignKey("circuits.id", ondelete="RESTRICT"), nullable=False
    )

    # Relationships
    circuit = relationship("Circuit", back_populates="sessions")
    results = relationship(
        "SessionResult", back_populates="session", cascade="all, delete-orphan"
    )
    laps = relationship("Lap", back_populates="session", cascade="all, delete-orphan")
    weather_data = relationship(
        "Weather", back_populates="session", cascade="all, delete-orphan"
    )
    track_status = relationship(
        "TrackStatus", back_populates="session", cascade="all, delete-orphan"
    )
    race_control_messages = relationship(
        "RaceControlMessage", back_populates="session", cascade="all, delete-orphan"
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint("year", "round", "session_type", name="uq_year_round_session"),
        Index("idx_year_session_type", "year", "session_type"),
    )

    def __repr__(self):
        """String representation for debugging"""
        return f"<Session {self.year} R{self.round} {self.session_type} - {self.event_name}>"
