"""
Replay Schemas

Pydantic models for race replay API responses.
"""

from pydantic import BaseModel


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
