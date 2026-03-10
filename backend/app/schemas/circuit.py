"""
Circuit Schemas

Pydantic models for circuit/track API responses.
"""

from pydantic import BaseModel
from typing import Optional, List


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
