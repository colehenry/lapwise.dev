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
