"""The latest published race and podium, shared by results and the homepage."""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.result import RoundPodiumDriver, RoundSummary
from app.services.results import SessionDataService, _make_slug


@dataclass
class LatestRace:
    season: int
    summary: RoundSummary


async def latest_race(db: AsyncSession) -> LatestRace | None:
    latest_session = await SessionDataService.get_latest_race_session(db)

    if not latest_session:
        return None

    rows = await SessionDataService.get_podium_results(db, latest_session.id)

    if not rows:
        return None

    podium = [
        RoundPodiumDriver(
            full_name=row.full_name,
            driver_code=row.driver_code,
            driver_slug=_make_slug(row.jolpica_id, row.full_name),
            country_code=row.country_code,
            team_name=row.team_name,
            team_color=row.team_color,
            headshot_url=row.headshot_url,
            fastest_lap=row.fastest_lap,
            time_seconds=row.time_seconds,
        )
        for row in rows
    ]

    first_row = rows[0]
    summary = RoundSummary(
        round=first_row.round,
        event_name=first_row.event_name,
        date=first_row.date,
        circuit_name=first_row.circuit_name,
        circuit_id=first_row.circuit_id,
        circuit_location=first_row.circuit_location,
        circuit_country=first_row.circuit_country,
        session_type=first_row.session_type,
        podium=podium,
    )

    return LatestRace(season=latest_session.year, summary=summary)
