"""
Events Router

API endpoints for F1 event schedules and upcoming races.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.event import UpcomingEventResponse
from app.security import verify_api_key
from app.services.event_service import EventService

router = APIRouter()


@router.get("/upcoming", response_model=list[UpcomingEventResponse])
async def get_upcoming_events(
    limit: int = 3,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get upcoming F1 events including preseason testing and races.

    Returns the next N upcoming events from the current season's calendar.
    Events are matched against the circuits database where possible.

    Args:
        limit: Number of upcoming events to return (default: 3, max: 10)

    Returns:
        List of upcoming events with circuit information
    """
    if limit < 1 or limit > 10:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 10")

    events = await EventService.get_upcoming_events(db, limit)
    return events
