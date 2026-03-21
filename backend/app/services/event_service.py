from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import fastf1

from app.models import Circuit
from app.schemas.event import UpcomingEventResponse


class EventService:
    """Service for event-related operations"""

    @staticmethod
    async def get_upcoming_events(
        db: AsyncSession, limit: int = 3
    ) -> list[UpcomingEventResponse]:
        """
        Get upcoming F1 events including preseason testing and races.
        Matches events against the circuits database where possible.
        """
        # Validate limit
        limit = max(1, min(limit, 10))

        # Get current year (check current year first, then next year)
        current_year = datetime.now().year
        today = datetime.now().date()

        upcoming = None

        # Try current year first
        try:
            schedule = fastf1.get_event_schedule(current_year, include_testing=True)
            all_events = schedule.sort_values("EventDate")

            # Filter for upcoming events
            upcoming = all_events[
                all_events["EventDate"].apply(
                    lambda x: x.date() if hasattr(x, "date") else x
                )
                >= today
            ]

            # If no upcoming events in current year, try next year
            if len(upcoming) == 0:
                schedule = fastf1.get_event_schedule(
                    current_year + 1, include_testing=True
                )
                all_events = schedule.sort_values("EventDate")
                upcoming = all_events[
                    all_events["EventDate"].apply(
                        lambda x: x.date() if hasattr(x, "date") else x
                    )
                    >= today
                ]

        except Exception as e:
            # Log error ideally
            print(f"Failed to fetch event schedule: {str(e)}")
            # For service pattern we might want to raise or return empty list
            # Return empty list to avoid crashing app if FastF1 fails
            return []

        if upcoming is None or len(upcoming) == 0:
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
            # We use _find_matching_circuit helper which encapsulates the query
            circuit = await EventService._find_matching_circuit(
                db, event["Location"], event["Country"]
            )

            if circuit:
                circuit_id = circuit.id
                circuit_name = circuit.name

            # Determine event type
            event_type = "testing" if event["RoundNumber"] == 0 else "race"

            # Convert EventDate to string
            event_date = event["EventDate"]
            if hasattr(event_date, "date"):
                event_date_str = event_date.date().isoformat()
            else:
                event_date_str = str(event_date)

            response_events.append(
                UpcomingEventResponse(
                    event_name=event["EventName"],
                    event_type=event_type,
                    event_date=event_date_str,
                    location=event["Location"],
                    country=event["Country"],
                    round_number=int(event["RoundNumber"])
                    if event["RoundNumber"] != 0
                    else None,
                    circuit_id=circuit_id,
                    circuit_name=circuit_name,
                )
            )

        return response_events

    @staticmethod
    async def _find_matching_circuit(
        db: AsyncSession, location: str, country: str
    ) -> Circuit | None:
        """Helper to find circuit by location/country"""
        # Exact match first
        circuit_query = select(Circuit).where(
            Circuit.location == location, Circuit.country == country
        )
        circuit_result = await db.execute(circuit_query)
        circuit = circuit_result.scalar_one_or_none()
        if circuit:
            return circuit

        # Fallback: case-insensitive match on location or country name
        circuit_query = select(Circuit).where(
            func.lower(Circuit.country) == country.lower()
        )
        circuit_result = await db.execute(circuit_query)
        circuit = circuit_result.scalar_one_or_none()
        return circuit
