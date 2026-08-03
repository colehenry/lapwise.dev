"""
Constructor Schemas

Pydantic models for constructor profile and statistics API responses.
"""

from typing import List, Optional

from pydantic import BaseModel


class ConstructorListItem(BaseModel):
    """Single constructor in the all-time constructors listing."""

    team_name: str
    constructor_slug: Optional[str] = None
    team_color: Optional[str] = None
    logo_url: Optional[str] = None
    total_wins: int
    total_races: int
    total_podiums: int
    total_points: float
    first_season: Optional[int] = None
    latest_season: Optional[int] = None

    class Config:
        from_attributes = True


class ConstructorListResponse(BaseModel):
    """Response for GET /api/constructors — all-time constructor listing."""

    constructors: List[ConstructorListItem]
    total: int

    class Config:
        from_attributes = True


class ConstructorProfileResponse(BaseModel):
    """
    Complete constructor profile with career statistics.

    Used for GET /api/constructors/{team_name} endpoint.
    """

    # Basic info
    team_name: str
    constructor_slug: Optional[str] = None
    team_color: Optional[str] = None
    logo_url: Optional[str] = None

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
    championship_points: Optional[float] = None
    points_scored: float
    classification_status: str = "classified"
    scoring_explanation: Optional[str] = None
    race_count: int = 0
    team_color: Optional[str] = None

    class Config:
        from_attributes = True


class ConstructorSeasonHistoryResponse(BaseModel):
    """
    Constructor's championship history across all seasons.

    Used for GET /api/constructors/{team_name}/season-history endpoint.
    """

    team_name: str
    constructor_slug: Optional[str] = None
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
    driver_1_code: Optional[str] = None
    driver_1_slug: Optional[str] = None
    driver_1_position: Optional[int] = None
    driver_1_status: Optional[str] = None
    driver_2_name: Optional[str] = None
    driver_2_code: Optional[str] = None
    driver_2_slug: Optional[str] = None
    driver_2_position: Optional[int] = None
    driver_2_status: Optional[str] = None

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
