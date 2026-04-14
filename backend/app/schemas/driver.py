"""
Driver Schemas

Pydantic models for driver profile and statistics API responses.
"""

from pydantic import BaseModel
from typing import Optional, List


class DriverListItem(BaseModel):
    """Single driver in the all-time drivers listing."""

    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    full_name: str
    country_code: Optional[str] = None
    headshot_url: Optional[str] = None
    total_wins: int
    total_races: int
    total_podiums: int
    total_points: float
    current_team: Optional[str] = None
    current_team_color: Optional[str] = None
    first_season: Optional[int] = None
    latest_season: Optional[int] = None

    class Config:
        from_attributes = True


class DriverListResponse(BaseModel):
    """Response for GET /api/drivers — all-time driver listing."""

    drivers: List[DriverListItem]
    total: int

    class Config:
        from_attributes = True


class DriverProfileResponse(BaseModel):
    """
    Complete driver profile with career statistics.

    Used for GET /api/drivers/{driver_code} endpoint.
    """

    # Basic info
    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
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
    race_count: int = 0
    team_name: str
    team_color: Optional[str] = None

    class Config:
        from_attributes = True


class DriverSeasonHistoryResponse(BaseModel):
    """
    Driver's championship history across all seasons.

    Used for GET /api/drivers/{driver_slug}/season-history endpoint.
    """

    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    full_name: str
    seasons: List[SeasonHistory]

    class Config:
        from_attributes = True


class RaceHistory(BaseModel):
    """Single race result for a driver"""

    year: int
    round: int
    race_name: str
    session_type: str = "race"
    position: Optional[int] = None
    grid_position: Optional[int] = None
    points: Optional[float] = None
    team_name: str
    team_color: Optional[str] = None
    status: str
    fastest_lap: bool = False

    class Config:
        from_attributes = True


class DriverRaceHistoryResponse(BaseModel):
    """
    Driver's race-by-race history across career.

    Used for GET /api/drivers/{driver_slug}/race-history endpoint.
    """

    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    full_name: str
    races: List[RaceHistory]
    available_years: List[int]

    class Config:
        from_attributes = True
