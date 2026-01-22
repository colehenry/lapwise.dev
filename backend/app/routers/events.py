"""
Events Router

API endpoints for F1 event schedules and upcoming races.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime
import fastf1

from app.database import get_db
from app.models import Circuit
from app.schemas.event import UpcomingEventResponse
from app.security import verify_api_key

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

    # Validate limit
    if limit < 1 or limit > 10:
        raise HTTPException(
            status_code=400, detail="Limit must be between 1 and 10"
        )

    # Get current year (check current year first, then next year)
    current_year = datetime.now().year
    today = datetime.now().date()

    # Try current year first
    try:
        schedule = fastf1.get_event_schedule(current_year, include_testing=True)
        all_events = schedule.sort_values('EventDate')

        # Filter for upcoming events
        upcoming = all_events[
            all_events['EventDate'].apply(
                lambda x: x.date() if hasattr(x, 'date') else x
            ) >= today
        ]

        # If no upcoming events in current year, try next year
        if len(upcoming) == 0:
            schedule = fastf1.get_event_schedule(current_year + 1, include_testing=True)
            all_events = schedule.sort_values('EventDate')
            upcoming = all_events[
                all_events['EventDate'].apply(
                    lambda x: x.date() if hasattr(x, 'date') else x
                ) >= today
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch event schedule: {str(e)}"
        )

    if len(upcoming) == 0:
        return []

    # Get requested number of events
    events_to_return = upcoming.head(limit)

    # Match circuits from database
    response_events = []
    for _, event in events_to_return.iterrows():
        # Try to find matching circuit in database
        circuit_id = None
        circuit_name = None

        # Match by location and country
        circuit_query = select(Circuit).where(
            Circuit.location == event['Location'],
            Circuit.country == event['Country']
        )
        circuit_result = await db.execute(circuit_query)
        circuit = circuit_result.scalar_one_or_none()

        if circuit:
            circuit_id = circuit.id
            circuit_name = circuit.name

        # Determine event type
        event_type = "testing" if event['RoundNumber'] == 0 else "race"

        # Convert EventDate to string for JSON serialization
        event_date = event['EventDate']
        if hasattr(event_date, 'date'):
            event_date_str = event_date.date().isoformat()
        else:
            event_date_str = str(event_date)

        response_events.append(
            UpcomingEventResponse(
                event_name=event['EventName'],
                event_type=event_type,
                event_date=event_date_str,
                location=event['Location'],
                country=event['Country'],
                round_number=int(event['RoundNumber']) if event['RoundNumber'] != 0 else None,
                circuit_id=circuit_id,
                circuit_name=circuit_name,
            )
        )

    return response_events
