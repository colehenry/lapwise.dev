"""
Circuit Schemas

Pydantic models for circuit/track API responses.
"""

from typing import List, Optional

from pydantic import BaseModel


class CircuitResponse(BaseModel):
    """
    Circuit information with statistics.

    Used for individual circuit responses.
    """

    # Basic info
    id: int
    name: str
    location: str
    country: str
    track_length_km: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # Statistics
    total_races: int
    first_year: int
    most_recent_year: int

    class Config:
        from_attributes = True


class CircuitListResponse(BaseModel):
    """
    List of circuits with metadata.

    Used for GET /api/circuits endpoint.
    """

    circuits: List[CircuitResponse]
    total: int

    class Config:
        from_attributes = True


class CircuitRaceResult(BaseModel):
    """Single race result at a circuit"""

    year: int
    round: int
    race_name: str
    winner_name: str
    winner_code: Optional[str] = None
    winner_slug: Optional[str] = None
    team_name: str
    team_color: Optional[str] = None

    class Config:
        from_attributes = True


class CircuitRaceHistoryResponse(BaseModel):
    """Race history at a specific circuit"""

    circuit_id: int
    circuit_name: str
    races: List[CircuitRaceResult]

    class Config:
        from_attributes = True


class CircuitStatDriver(BaseModel):
    """Driver or team statistic at a circuit"""

    name: str
    code: Optional[str] = None
    slug: Optional[str] = None
    count: int
    color: Optional[str] = None

    class Config:
        from_attributes = True


class CircuitStatisticsResponse(BaseModel):
    """Aggregated statistics for a circuit"""

    circuit_id: int
    circuit_name: str
    most_wins: List[CircuitStatDriver]
    most_poles: List[CircuitStatDriver]
    most_fastest_laps: List[CircuitStatDriver]
    constructor_wins: List[CircuitStatDriver]

    class Config:
        from_attributes = True


class LapRecordEntry(BaseModel):
    """A single lap record (fastest race lap or qualifying lap)"""

    time_seconds: float
    driver_name: str
    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    team_name: str
    team_color: Optional[str] = None
    year: int

    class Config:
        from_attributes = True


class CircuitLapRecordsResponse(BaseModel):
    """Lap records for a circuit"""

    circuit_id: int
    circuit_name: str
    fastest_race_lap: Optional[LapRecordEntry] = None
    fastest_qualifying_lap: Optional[LapRecordEntry] = None

    class Config:
        from_attributes = True


class RecentRacePodiumEntry(BaseModel):
    """A podium finisher in the recent race"""

    position: int
    driver_name: str
    driver_code: Optional[str] = None
    driver_slug: Optional[str] = None
    team_name: str
    team_color: Optional[str] = None

    class Config:
        from_attributes = True


class CircuitRecentRaceResponse(BaseModel):
    """Most recent race at a circuit"""

    circuit_id: int
    circuit_name: str
    year: int
    round: int
    event_name: str
    date: str
    podium: List[RecentRacePodiumEntry]
    fastest_lap_driver: Optional[str] = None
    fastest_lap_time: Optional[float] = None
    avg_air_temp: Optional[float] = None
    avg_track_temp: Optional[float] = None
    had_rainfall: Optional[bool] = None

    class Config:
        from_attributes = True


class LapTimeTrendEntry(BaseModel):
    """Fastest lap time for a specific year at a circuit"""

    year: int
    fastest_lap_seconds: float
    driver_name: str
    driver_code: Optional[str] = None
    team_color: Optional[str] = None

    class Config:
        from_attributes = True


class CircuitLapTimeTrendResponse(BaseModel):
    """Lap time evolution across years at a circuit"""

    circuit_id: int
    circuit_name: str
    trend: List[LapTimeTrendEntry]

    class Config:
        from_attributes = True


class CircuitWeatherProfileResponse(BaseModel):
    """Aggregated weather profile for a circuit"""

    circuit_id: int
    circuit_name: str
    races_with_weather: int
    avg_air_temp: Optional[float] = None
    avg_track_temp: Optional[float] = None
    avg_humidity: Optional[float] = None
    avg_wind_speed: Optional[float] = None
    wet_race_count: int = 0
    total_races_checked: int = 0

    class Config:
        from_attributes = True


class CompoundUsageEntry(BaseModel):
    """Usage stats for a single tyre compound"""

    compound: str
    total_laps: int
    avg_stint_length: Optional[float] = None
    percentage: float

    class Config:
        from_attributes = True


class CircuitTyreStatsResponse(BaseModel):
    """Tyre strategy breakdown for a circuit"""

    circuit_id: int
    circuit_name: str
    races_with_data: int
    compounds: List[CompoundUsageEntry]

    class Config:
        from_attributes = True
