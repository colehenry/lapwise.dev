"""Race-weekend availability metadata."""

from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class RoundAvailabilityResponse(BaseModel):
    """What a race weekend offers, without any results or lap data.

    Lets a client load one active session instead of probing every session
    type to discover which tabs exist.
    """

    season: int
    round: int
    event_name: str
    date: date
    circuit_id: Optional[int] = None
    circuit_name: Optional[str] = None
    session_types: List[str]
    practice_numbers: List[int]
    has_sprint: bool
    summary_session_types: List[str]

    class Config:
        from_attributes = True
