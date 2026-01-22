"""
Driver Schemas

Pydantic models for driver profile and statistics API responses.
"""

from pydantic import BaseModel
from typing import Optional, List


class DriverProfileResponse(BaseModel):
    """
    Complete driver profile with career statistics.

    Used for GET /api/drivers/{driver_code} endpoint.
    """

    # Basic info
    driver_code: str
    full_name: str
    driver_number: Optional[int] = None
    country_code: Optional[str] = None
    headshot_url: Optional[str] = None

    # Career statistics
    total_seasons: int
    total_races: int
    total_championships: int
    total_wins: int
    total_podiums: int
    total_points: float
    best_finish: Optional[int] = None  # Best finishing position (1 = win)

    # Current team (from most recent race)
    current_team: Optional[str] = None
    current_team_color: Optional[str] = None

    # Most recent season
    latest_season: Optional[int] = None

    class Config:
        from_attributes = True


class SeasonHistory(BaseModel):
    """Single season championship result for a driver"""

    year: int
    championship_position: Optional[int] = None
    total_points: float
    team_name: str
    team_color: Optional[str] = None

    class Config:
        from_attributes = True


class DriverSeasonHistoryResponse(BaseModel):
    """
    Driver's championship history across all seasons.

    Used for GET /api/drivers/{driver_code}/season-history endpoint.
    """

    driver_code: str
    full_name: str
    seasons: List[SeasonHistory]

    class Config:
        from_attributes = True


class RaceHistory(BaseModel):
    """Single race result for a driver"""

    year: int
    round: int
    race_name: str
    position: Optional[int] = None
    points: Optional[float] = None
    team_name: str
    team_color: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class DriverRaceHistoryResponse(BaseModel):
    """
    Driver's race-by-race history across career.

    Used for GET /api/drivers/{driver_code}/race-history endpoint.
    """

    driver_code: str
    full_name: str
    races: List[RaceHistory]
    available_years: List[int]

    class Config:
        from_attributes = True
