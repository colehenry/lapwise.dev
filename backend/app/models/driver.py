"""
Driver Model

Represents a Formula 1 driver across their entire career.
Each driver has a unique ID and core information that doesn't change often.
"""

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Driver(Base):
    """
    Represents a Formula 1 driver.

    A driver can participate in multiple races (one-to-many relationship).
    """

    __tablename__ = "drivers"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Core driver information
    slug = Column(String, nullable=False, unique=True, index=True)
    full_name = Column(String, nullable=False)
    # Deprecated preferred/latest display code. Identity and season codes live in
    # driver_external_ids and driver_seasons respectively.
    driver_code = Column(String(3), nullable=True)
    jolpica_id = Column(
        String, nullable=True, unique=True, index=True
    )  # Jolpica/Ergast stable ID e.g. "fangio", "hamilton"
    driver_number = Column(Integer, nullable=True)  # Permanent number (e.g., 1, 44, 16)
    country_code = Column(String(3), nullable=True)  # NED, GBR, MON, etc.

    # Relationships
    # This creates a "virtual" attribute: driver.session_results
    # It allows you to do: driver.session_results to get all results for this driver
    session_results = relationship("SessionResult", back_populates="driver")
    laps = relationship("Lap", back_populates="driver")
    pit_stops = relationship("PitStop", back_populates="driver")
    external_ids = relationship(
        "DriverExternalId", back_populates="driver", cascade="all, delete-orphan"
    )
    seasons = relationship(
        "DriverSeason", back_populates="driver", cascade="all, delete-orphan"
    )

    @property
    def driver_slug(self) -> str:
        """URL-safe slug: jolpica_id if available, else slugified full_name."""
        return self.slug

    def __repr__(self):
        """String representation for debugging"""
        return f"<Driver {self.driver_code} - {self.full_name}>"
