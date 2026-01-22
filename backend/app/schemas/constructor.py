"""
Constructor Schemas

Pydantic models for constructor profile and statistics API responses.
"""

from pydantic import BaseModel
from typing import Optional, List


class ConstructorProfileResponse(BaseModel):
    """
    Complete constructor profile with career statistics.

    Used for GET /api/constructors/{team_name} endpoint.
    """

    # Basic info
    team_name: str
    team_color: Optional[str] = None

    # Career statistics
    total_seasons: int
    total_races: int
    total_championships: int
    total_wins: int
    total_podiums: int
    total_points: float
    best_finish: Optional[int] = None  # Best finishing position (1 = win)

    # Most recent season
    latest_season: Optional[int] = None

    class Config:
        from_attributes = True


class ConstructorSeasonHistory(BaseModel):
    """Single season championship result for a constructor"""

    year: int
    championship_position: Optional[int] = None
    total_points: float
    team_color: Optional[str] = None

    class Config:
        from_attributes = True


class ConstructorSeasonHistoryResponse(BaseModel):
    """
    Constructor's championship history across all seasons.

    Used for GET /api/constructors/{team_name}/season-history endpoint.
    """

    team_name: str
    seasons: List[ConstructorSeasonHistory]

    class Config:
        from_attributes = True


class ConstructorRaceHistory(BaseModel):
    """Single race result for a constructor"""

    year: int
    round: int
    race_name: str
    best_position: Optional[int] = None
    total_points: float
    driver_1_name: Optional[str] = None
    driver_1_position: Optional[int] = None
    driver_2_name: Optional[str] = None
    driver_2_position: Optional[int] = None

    class Config:
        from_attributes = True


class ConstructorRaceHistoryResponse(BaseModel):
    """
    Constructor's race-by-race history across career.

    Used for GET /api/constructors/{team_name}/race-history endpoint.
    """

    team_name: str
    races: List[ConstructorRaceHistory]
    available_years: List[int]

    class Config:
        from_attributes = True
