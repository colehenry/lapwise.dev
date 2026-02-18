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
    full_name = Column(String, nullable=False)
    driver_code = Column(String(3), nullable=True, unique=True)  # VER, HAM, LEC, etc. (null for pre-2003 drivers without official codes)
    jolpica_id = Column(String, nullable=True, unique=True, index=True)  # Jolpica/Ergast stable ID e.g. "fangio", "hamilton"
    driver_number = Column(Integer, nullable=True)  # Permanent number (e.g., 1, 44, 16)
    country_code = Column(String(3), nullable=True)  # NED, GBR, MON, etc.

    # Relationships
    # This creates a "virtual" attribute: driver.session_results
    # It allows you to do: driver.session_results to get all results for this driver
    session_results = relationship("SessionResult", back_populates="driver")
    laps = relationship("Lap", back_populates="driver")

    def __repr__(self):
        """String representation for debugging"""
        return f"<Driver {self.driver_code} - {self.full_name}>"
