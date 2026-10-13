"""Find a playable race without constructing or downloading candidate replays."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Lap, Session, SessionResult
from app.schemas.console_availability import (
    ConsoleAvailabilityResponse,
    ConsoleReplayReference,
)
from app.services.console_replay_service import MIN_LAPS
from app.services.latest_race_service import latest_race

WALK_BACK_ROUNDS = 4


async def console_availability(db: AsyncSession) -> ConsoleAvailabilityResponse:
    latest = await latest_race(db)
    if latest is None:
        return ConsoleAvailabilityResponse(season=None, latest=None, replay=None)

    # Match the console's minimum usable lap count per classified driver. Four
    # untimed laps, or one lap each from four drivers, cannot produce a car.
    playable = (
        select(Lap.driver_id)
        .join(
            SessionResult,
            (SessionResult.session_id == Lap.session_id)
            & (SessionResult.driver_id == Lap.driver_id),
        )
        .where(Lap.session_id == Session.id)
        # Playback sanitizes null, NaN and infinity to missing lap starts.
        .where(Lap.lap_start_time_seconds > float("-inf"))
        .where(Lap.lap_start_time_seconds < float("inf"))
        .group_by(Lap.driver_id)
        .having(func.count() >= MIN_LAPS)
        .correlate(Session)
        .exists()
    )
    candidate = (
        select(Session.id, Session.round)
        .where(Session.year == latest.season, Session.session_type == "race")
        .where(
            Session.round.between(
                max(1, latest.summary.round - WALK_BACK_ROUNDS), latest.summary.round
            ),
            playable,
        )
        .order_by(Session.round.desc())
        .limit(1)
        .subquery()
    )
    row = (
        await db.execute(
            select(
                candidate.c.id,
                candidate.c.round,
                func.count(Lap.id).label("lap_count"),
                func.max(Lap.id).label("last_lap_id"),
            )
            .join(Lap, Lap.session_id == candidate.c.id)
            .group_by(candidate.c.id, candidate.c.round)
        )
    ).first()
    return ConsoleAvailabilityResponse(
        season=latest.season,
        latest=latest.summary,
        replay=(
            ConsoleReplayReference(
                season=latest.season,
                round=row.round,
                # Appended laps and force re-ingestion change the cache key.
                revision=f"{row.id}-{row.lap_count}-{row.last_lap_id}",
            )
            if row is not None
            else None
        ),
    )
