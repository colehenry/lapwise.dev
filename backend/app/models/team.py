"""
Team (Constructor) Model

Represents a Formula 1 team/constructor for a specific year.
Teams can change names, colors, and identities between years
(e.g., Racing Point → Aston Martin in 2021).
"""

from sqlalchemy import Column, Integer, String, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from app.database import Base


class Team(Base):
    """
    Represents a Formula 1 team/constructor for a specific year.

    A team's identity (name, color) can change year-to-year, so we store
    one record per year-team combination.
    """

    __tablename__ = "teams"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Year identification (NEW - teams change per year)
    year = Column(Integer, nullable=False, index=True)

    # Team information
    name = Column(String, nullable=False)  # "Red Bull Racing"
    team_color = Column(String(6), nullable=True)  # Hex without #: "3671C6"

    # Relationships
    session_results = relationship("SessionResult", back_populates="team")

    # Constraints
    __table_args__ = (
        UniqueConstraint("year", "name", name="uq_team_year_name"),
        Index("idx_team_year", "year"),
    )

    def __repr__(self):
        """String representation for debugging"""
        return f"<Team {self.name}>"
