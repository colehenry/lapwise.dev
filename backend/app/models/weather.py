"""
Weather Model

Represents time-series weather data for a session.
Weather is sampled approximately once per minute during a session.
"""

from sqlalchemy import Column, Integer, Float, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class Weather(Base):
    """
    Represents weather conditions at a specific point in time during a session.

    Weather data updates approximately once per minute, so a 2-hour session
    will have ~120 weather records.

    Fields correspond to FastF1's weather_data DataFrame:
    https://docs.fastf1.dev/core.html#fastf1.core.Session.weather_data
    """

    __tablename__ = "weather_data"

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

    # Temperature data (Celsius)
    air_temp = Column(Float, nullable=True)  # Air temperature
    track_temp = Column(Float, nullable=True)  # Track surface temperature

    # Atmospheric conditions
    humidity = Column(Float, nullable=True)  # Humidity percentage (0-100)
    pressure = Column(Float, nullable=True)  # Air pressure (mbar)

    # Wind
    wind_speed = Column(Float, nullable=True)  # Wind speed (m/s)
    wind_direction = Column(Integer, nullable=True)  # Wind direction (degrees, 0-360)

    # Precipitation
    rainfall = Column(Boolean, nullable=True)  # Is it raining?

    # Relationships
    session = relationship("Session", back_populates="weather_data")

    # Constraints
    __table_args__ = (
        # Optimize for time-based queries (get weather at specific time, weather during range)
        Index("idx_session_time", "session_id", "session_time_seconds"),
    )

    def __repr__(self):
        """String representation for debugging"""
        return f"<Weather session_id={self.session_id} time={self.session_time_seconds}s air={self.air_temp}°C>"
