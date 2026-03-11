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

    id: int  # Circuit ID used to construct track map URL
    name: str
    location: str
    country: str
    track_length_km: Optional[float] = None
    track_map_url: Optional[str] = None  # Computed: /track-maps/{id}.png

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
    highlights_video_id: Optional[str] = None

    class Config:
        from_attributes = True


class DriverInfo(BaseModel):
    """Driver metadata embedded in result"""

    driver_number: Optional[int] = None
    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    full_name: str
    country_code: Optional[str] = None

    class Config:
        from_attributes = True


class TeamInfo(BaseModel):
    """Team metadata embedded in result"""

    name: str
    team_color: Optional[str] = None  # Hex without #
    logo_url: Optional[str] = None

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
    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
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
    logo_url: Optional[str] = None
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
# Qualifying Standings Schemas (for /api/results/{season}/qualifying-standings)
# ============================================================================


class DriverQualifyingStanding(BaseModel):
    """Individual driver's qualifying championship standing for a season"""

    position: int
    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    full_name: str
    country_code: Optional[str] = None
    team_name: str
    team_color: Optional[str] = None
    total_qualifying_points: float
    headshot_url: Optional[str] = None
    poles: int
    p2s: int
    p3s: int

    class Config:
        from_attributes = True


class ConstructorQualifyingStanding(BaseModel):
    """Individual constructor's qualifying championship standing for a season"""

    position: int
    team_name: str
    team_color: Optional[str] = None
    logo_url: Optional[str] = None
    total_qualifying_points: float
    poles: int
    p2s: int
    p3s: int

    class Config:
        from_attributes = True


class QualifyingStandingsResponse(BaseModel):
    """
    Complete qualifying standings response for GET /api/results/{season}/qualifying-standings.
    """

    year: int
    drivers: List[DriverQualifyingStanding]
    constructors: List[ConstructorQualifyingStanding]

    class Config:
        from_attributes = True


# ============================================================================
# Season Rounds Schemas (for /api/results/{season})
# ============================================================================


class RoundPodiumDriver(BaseModel):
    """Driver information for podium finisher"""

    full_name: str
    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    country_code: Optional[str] = None
    team_name: str
    team_color: Optional[str] = None
    logo_url: Optional[str] = None
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
    circuit_id: int  # For track map URL
    track_length_km: Optional[float] = None
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
    """Single round's cumulative points total or session position"""

    round: str  # Round identifier: "21" for race, "21-sprint" for sprint
    cumulative_points: float
    position: Optional[int] = None  # Non-cumulative position for qualifying
    event_name: Optional[str] = None  # Grand Prix name (e.g., "Chinese Grand Prix")

    class Config:
        from_attributes = True


class DriverProgressionData(BaseModel):
    """Driver with cumulative points progression across all rounds"""

    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    full_name: str
    team_name: Optional[str] = None
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
    # For qualifying mode, we might want to return all positions for the team
    all_positions: Optional[List[List[int]]] = None

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
    stint: Optional[int] = None  # Stint number (1, 2, 3, ...)
    track_status: Optional[str] = None  # 1=green, 2=yellow, etc.

    # Sector times (seconds)
    sector1_time_seconds: Optional[float] = None
    sector2_time_seconds: Optional[float] = None
    sector3_time_seconds: Optional[float] = None

    # Pit stop data
    pit_in_time_seconds: Optional[float] = None
    pit_out_time_seconds: Optional[float] = None
    pit_duration_seconds: Optional[float] = None

    # Position and speed traps
    position: Optional[int] = None  # Track position after this lap
    speed_st: Optional[float] = None  # Speed trap (km/h)
    speed_i1: Optional[float] = None  # Intermediate 1 speed (km/h)
    speed_i2: Optional[float] = None  # Intermediate 2 speed (km/h)
    speed_fl: Optional[float] = None  # Finish line speed (km/h)

    # Tyre and accuracy flags
    fresh_tyre: Optional[bool] = None  # Is this a new tyre set?
    is_personal_best: Optional[bool] = None
    deleted: Optional[bool] = None  # Lap time deleted by FIA

    class Config:
        from_attributes = True


class DriverLapTimesData(BaseModel):
    """Driver metadata with all their lap times for a session"""

    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    full_name: str
    country_code: Optional[str] = None
    team_color: Optional[str] = None
    final_position: Optional[int] = None  # Finishing position in this race
    laps: List[LapData]

    class Config:
        from_attributes = True


class TrackStatusEvent(BaseModel):
    """A single track status change event during a session"""

    session_time_seconds: float  # Seconds since session start
    status: str  # "1"=green, "2"=yellow, "4"=SC, "5"=red, "6"=VSC, "7"=VSC ending
    message: Optional[str] = None

    class Config:
        from_attributes = True


class RaceControlEvent(BaseModel):
    """A significant race control message (SC deployment, rain, DRS, retirements)"""

    session_time_seconds: float
    lap_number: Optional[int] = None
    category: Optional[str] = None  # "Flag", "Drs", "CarEvent", "Other"
    message: str
    flag: Optional[str] = None
    scope: Optional[str] = None  # "Track", "Driver", "Sector"
    driver_number: Optional[int] = None

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
    total_laps: Optional[int] = None  # Total laps in the race
    drivers: List[DriverLapTimesData]
    track_status_events: List[TrackStatusEvent] = []
    race_control_events: List[RaceControlEvent] = []

    class Config:
        from_attributes = True


# ============================================================================
# Qualifying Sector Comparison Schemas
# ============================================================================


class QualifyingSectorComparison(BaseModel):
    """Best sector times per driver for a qualifying session"""

    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    full_name: str
    team_color: Optional[str] = None
    headshot_url: Optional[str] = None
    best_sector1: Optional[float] = None
    best_sector2: Optional[float] = None
    best_sector3: Optional[float] = None
    best_lap_time: Optional[float] = None
    q_session: str  # "Q1", "Q2", "Q3"

    class Config:
        from_attributes = True


class QualifyingSectorResponse(BaseModel):
    """Response for qualifying sector comparison endpoint"""

    year: int
    round: int
    event_name: str
    sectors: List[QualifyingSectorComparison]

    class Config:
        from_attributes = True


# ============================================================================
# Weather Schemas
# ============================================================================


class WeatherDataPoint(BaseModel):
    """A single weather data point during a session"""

    session_time_seconds: float
    air_temp: Optional[float] = None
    track_temp: Optional[float] = None
    humidity: Optional[float] = None
    pressure: Optional[float] = None
    wind_speed: Optional[float] = None
    wind_direction: Optional[int] = None
    rainfall: Optional[bool] = None

    class Config:
        from_attributes = True


class WeatherResponse(BaseModel):
    """Weather data for a session"""

    year: int
    round: int
    event_name: str
    weather: List[WeatherDataPoint]

    class Config:
        from_attributes = True
