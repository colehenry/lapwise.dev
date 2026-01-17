"""
Result Schemas

Pydantic models for API request/response validation for session results.
These schemas define what data the API endpoints will return to the frontend.
"""

from pydantic import BaseModel
from datetime import date
from typing import Optional, List


class CircuitInfo(BaseModel):
    """Circuit metadata embedded in session response"""

    name: str
    location: str
    country: str
    track_length_km: Optional[float] = None

    class Config:
        from_attributes = True


class SessionInfo(BaseModel):
    """
    Session metadata (race, qualifying, sprint, etc.).
    This is the top-level information about a specific F1 session.
    """

    id: int
    year: int
    round: int
    session_type: str  # 'race', 'sprint_race', 'qualifying', 'sprint_qualifying'
    event_name: str
    date: date
    circuit: CircuitInfo

    class Config:
        from_attributes = True


class DriverInfo(BaseModel):
    """Driver metadata embedded in result"""

    driver_number: Optional[int] = None
    driver_code: str
    full_name: str
    country_code: Optional[str] = None

    class Config:
        from_attributes = True


class TeamInfo(BaseModel):
    """Team metadata embedded in result"""

    name: str
    team_color: Optional[str] = None  # Hex without #

    class Config:
        from_attributes = True


class SessionResultDetail(BaseModel):
    """
    Individual driver's result in a session.

    Contains universal fields (position, status) plus session-specific fields:
    - Race/Sprint: points, time_seconds, fastest_lap, etc.
    - Qualifying: q1_time_seconds, q2_time_seconds, q3_time_seconds
    """

    # Universal fields
    position: Optional[int] = None
    status: str
    headshot_url: Optional[str] = None

    # Embedded driver/team info (from JOINs)
    driver: DriverInfo
    team: TeamInfo

    # Race/Sprint specific (NULL for qualifying)
    grid_position: Optional[int] = None
    points: Optional[float] = None
    laps_completed: Optional[int] = None
    time_seconds: Optional[float] = None
    fastest_lap: bool = False

    # Qualifying specific (NULL for race/sprint)
    q1_time_seconds: Optional[float] = None
    q2_time_seconds: Optional[float] = None
    q3_time_seconds: Optional[float] = None

    class Config:
        from_attributes = True


class SessionResultsResponse(BaseModel):
    """
    Complete response for GET /api/results endpoint.

    Returns session metadata plus an array of driver results.
    Results are typically sorted by position (P1 first).
    """

    session: SessionInfo
    results: List[SessionResultDetail]

    class Config:
        from_attributes = True


# ============================================================================
# Standings Schemas (for /api/results/{season}/standings)
# ============================================================================


class DriverStanding(BaseModel):
    """Individual driver's championship standing for a season"""

    position: int  # Championship position (1st, 2nd, 3rd, etc.)
    driver_code: str
    full_name: str
    country_code: Optional[str] = None
    team_name: str
    team_color: Optional[str] = None
    total_points: float
    headshot_url: Optional[str] = None

    class Config:
        from_attributes = True


class ConstructorStanding(BaseModel):
    """Individual constructor's championship standing for a season"""

    position: int  # Championship position (1st, 2nd, 3rd, etc.)
    team_name: str
    team_color: Optional[str] = None
    total_points: float

    class Config:
        from_attributes = True


class StandingsResponse(BaseModel):
    """
    Complete standings response for GET /api/results/{season}/standings.

    Returns driver and constructor standings for an entire season.
    """

    year: int
    drivers: List[DriverStanding]
    constructors: List[ConstructorStanding]

    class Config:
        from_attributes = True


# ============================================================================
# Season Rounds Schemas (for /api/results/{season})
# ============================================================================


class RoundPodiumDriver(BaseModel):
    """Driver information for podium finisher"""

    full_name: str
    driver_code: str
    country_code: Optional[str] = None
    team_name: str
    team_color: Optional[str] = None
    headshot_url: Optional[str] = None
    fastest_lap: bool = False

    class Config:
        from_attributes = True


class RoundSummary(BaseModel):
    """
    Summary of a single round showing top 3 finishers.

    Used in the main results page to display all rounds for a season.
    """

    round: int
    event_name: str
    date: date
    circuit_name: str
    session_type: str  # 'race', 'sprint_race', 'qualifying', 'sprint_qualifying'
    podium: List[RoundPodiumDriver]  # Top 3 drivers

    class Config:
        from_attributes = True


class SeasonRoundsResponse(BaseModel):
    """
    Complete response for GET /api/results/{season}.

    Returns all rounds for a season with top 3 finishers for each.
    """

    year: int
    rounds: List[RoundSummary]

    class Config:
        from_attributes = True


# ============================================================================
# Points Progression Schemas (for /api/results/{season}/points-progression)
# ============================================================================


class PointsProgressionRound(BaseModel):
    """Single round's cumulative points total"""

    round: str  # Round identifier: "21" for race, "21-sprint" for sprint
    cumulative_points: float
    event_name: Optional[str] = None  # Grand Prix name (e.g., "Chinese Grand Prix")

    class Config:
        from_attributes = True


class DriverProgressionData(BaseModel):
    """Driver with cumulative points progression across all rounds"""

    driver_code: str
    full_name: str
    team_color: Optional[str] = None
    final_position: int  # Final championship position for sorting
    progression: List[PointsProgressionRound]

    class Config:
        from_attributes = True


class ConstructorProgressionData(BaseModel):
    """Constructor with cumulative points progression across all rounds"""

    team_name: str
    team_color: Optional[str] = None
    final_position: int  # Final championship position for sorting
    progression: List[PointsProgressionRound]

    class Config:
        from_attributes = True


class PointsProgressionResponse(BaseModel):
    """
    Complete response for GET /api/results/{season}/points-progression.

    Returns cumulative points progression throughout the season.
    The 'type' field determines whether data contains drivers or constructors.
    """

    year: int
    type: str  # 'drivers' or 'constructors'
    drivers: Optional[List[DriverProgressionData]] = None
    constructors: Optional[List[ConstructorProgressionData]] = None

    class Config:
        from_attributes = True


# ============================================================================
# Lap Times Schemas (for /api/results/{season}/{round}/lap-times)
# ============================================================================


class LapData(BaseModel):
    """Individual lap timing and metadata"""

    lap_number: int
    lap_time_seconds: Optional[float] = None  # NULL for in/out laps, deleted laps
    compound: Optional[str] = None  # SOFT, MEDIUM, HARD, INTERMEDIATE, WET
    tyre_life: Optional[int] = None  # Laps on this tyre set
    track_status: Optional[str] = None  # 1=green, 2=yellow, etc.

    class Config:
        from_attributes = True


class DriverLapTimesData(BaseModel):
    """Driver metadata with all their lap times for a session"""

    driver_code: str
    full_name: str
    country_code: Optional[str] = None
    team_color: Optional[str] = None
    final_position: Optional[int] = None  # Finishing position in this race
    laps: List[LapData]

    class Config:
        from_attributes = True


class LapTimesResponse(BaseModel):
    """
    Complete response for GET /api/results/{season}/{round}/lap-times.

    Returns lap-by-lap timing data for all drivers in a specific race session.
    """

    year: int
    round: int
    event_name: str
    drivers: List[DriverLapTimesData]

    class Config:
        from_attributes = True
