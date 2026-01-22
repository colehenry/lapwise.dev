"""
Event Schemas

Pydantic models for F1 event and calendar API responses.
"""

from pydantic import BaseModel
from typing import Optional


class UpcomingEventResponse(BaseModel):
    """
    Upcoming F1 event information.

    Used for GET /api/events/upcoming endpoint.
    Includes both race weekends and preseason testing.
    """

    # Event information
    event_name: str  # "Australian Grand Prix" or "Pre-Season Testing"
    event_type: str  # "race" or "testing"
    event_date: str  # ISO date string (YYYY-MM-DD)

    # Location
    location: str  # "Melbourne", "Bahrain"
    country: str  # "Australia", "Bahrain"

    # Round information (null for testing events)
    round_number: Optional[int] = None

    # Circuit database link (if circuit exists in database)
    circuit_id: Optional[int] = None
    circuit_name: Optional[str] = None

    class Config:
        from_attributes = True
