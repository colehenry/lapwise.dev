"""
Replay Schemas

Pydantic models for race replay API responses.
"""

from pydantic import BaseModel, Field


class ReplayListItem(BaseModel):
    """Individual replay entry in the available replays list."""

    round: int
    event_name: str
    date: str
    circuit_name: str
    circuit_id: int
    total_laps: int
    total_duration_seconds: float
    driver_count: int
    compressed_size_bytes: int


class ReplayListResponse(BaseModel):
    """Response for GET /api/replay/available."""

    season: int
    replays: list[ReplayListItem]


class ReplaySeasonsResponse(BaseModel):
    """Response for GET /api/replay/seasons."""

    seasons: list[int]


class ReplayCorner(BaseModel):
    """Corner location in normalized replay track coordinates."""

    x: float
    y: float
    number: int
    letter: str = ""


class ReplayTrackGeometry(BaseModel):
    """Static replay track geometry without the heavy frame payload."""

    polyline: list[list[float]]
    rotation_deg: float = 0
    corners: list[ReplayCorner] = Field(default_factory=list)
    drs_zones: list[list[list[float]]] = Field(default_factory=list)


class ReplayTrackResponse(BaseModel):
    """Latest replay-backed track geometry for a circuit."""

    season: int
    round: int
    event_name: str
    circuit_id: int
    circuit_name: str
    track: ReplayTrackGeometry
