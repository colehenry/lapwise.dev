import logging
from datetime import datetime

import fastf1
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Circuit, Session
from app.schemas.event import UpcomingEventResponse

logger = logging.getLogger(__name__)

# How far back a "last time here" link may reach. Circuits rotate on and off the
# calendar, so a season or two of gap is normal — but a venue whose record stops
# decades ago is not the track that is about to be raced. Madrid is the case
# that matters: the circuit row carries nine races ending in 1981 at Jarama,
# while the 2026 event is a new layout entirely.
LAST_RACE_SEASON_WINDOW = 3


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
            logger.warning("Failed to fetch event schedule: %s", e)
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

            race_start_utc = EventService._race_start_utc(event)

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
                    race_start_utc=race_start_utc,
                    location=event["Location"],
                    country=event["Country"],
                    round_number=int(event["RoundNumber"])
                    if event["RoundNumber"] != 0
                    else None,
                    circuit_id=circuit_id,
                    circuit_name=circuit_name,
                )
            )

        latest = await EventService._last_races(
            db,
            [event.circuit_id for event in response_events if event.circuit_id],
        )
        oldest_useful = current_year - LAST_RACE_SEASON_WINDOW
        for event in response_events:
            raced = latest.get(event.circuit_id) if event.circuit_id else None
            if raced and raced[0] >= oldest_useful:
                event.last_raced_season, event.last_raced_round = raced

        return response_events

    @staticmethod
    async def _last_races(
        db: AsyncSession, circuit_ids: list[int]
    ) -> dict[int, tuple[int, int]]:
        """The most recent race already run at each circuit, in one query.

        Asked for every upcoming circuit at once rather than per event: four
        round trips to decide four links is the kind of excess the homepage is
        supposed to avoid.
        """
        if not circuit_ids:
            return {}

        rows = await db.execute(
            select(Session.circuit_id, Session.year, Session.round)
            .where(Session.circuit_id.in_(circuit_ids))
            .where(Session.session_type == "race")
            # Already run, so a scheduled round does not report itself.
            .where(Session.date < datetime.now().date())
            .order_by(Session.circuit_id, Session.date.desc())
        )

        latest: dict[int, tuple[int, int]] = {}
        for circuit_id, year, round_number in rows.all():
            latest.setdefault(circuit_id, (year, round_number))
        return latest

    @staticmethod
    def _race_start_utc(event) -> str | None:
        """The race session's start, in UTC.

        Found by name rather than by slot: a sprint weekend reorders the
        sessions, so the race is not always the fifth one.
        """
        for slot in range(1, 6):
            if str(event.get(f"Session{slot}")) != "Race":
                continue
            start = event.get(f"Session{slot}DateUtc")
            if start is None or pd.isna(start):
                return None
            return start.isoformat()
        return None

    @staticmethod
    async def _find_matching_circuit(
        db: AsyncSession, location: str, country: str
    ) -> Circuit | None:
        """The layout a schedule entry names, by location then by country.

        A location can carry more than one layout — Madrid is Jarama through
        1981 and the Madring from 2026 — so a match is the layout raced most
        recently, and a layout never raced yet outranks one long retired.
        """
        circuit = await EventService._latest_layout(
            db, Circuit.location == location, Circuit.country == country
        )
        if circuit:
            return circuit
        return await EventService._latest_layout(
            db, func.lower(Circuit.country) == country.lower()
        )

    @staticmethod
    async def _latest_layout(db: AsyncSession, *criteria) -> Circuit | None:
        """One layout among those matching: most recent session first, then
        the newest row for a layout with no sessions at all."""
        last_session = (
            select(Session.circuit_id, func.max(Session.date).label("last"))
            .group_by(Session.circuit_id)
            .subquery()
        )
        query = (
            select(Circuit)
            .outerjoin(last_session, last_session.c.circuit_id == Circuit.id)
            .where(*criteria)
            .order_by(last_session.c.last.desc().nulls_last(), Circuit.id.desc())
            .limit(1)
        )
        return (await db.execute(query)).scalar_one_or_none()
