"""Fixtures for read-only query-budget measurement.

These tests execute real service reads against whichever database
`DATABASE_URL` points at. They never write. When the database has no ingested
session data — the CI database, for example — they skip instead of failing.
"""

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.models import Driver, SessionResult, Team
from app.models import Session as RaceSession


@pytest_asyncio.fixture
async def db(db_session):
    return db_session


@pytest_asyncio.fixture(autouse=True)
async def require_ingested_data(ingested_data):
    return ingested_data


@pytest_asyncio.fixture
async def latest_season(db) -> int:
    return int(await db.scalar(select(func.max(RaceSession.year))))


@pytest_asyncio.fixture
async def profiled_driver_code(db, latest_season) -> str:
    """A driver code with results in the most recent ingested season."""
    code = await db.scalar(
        select(Driver.driver_code)
        .join(SessionResult, SessionResult.driver_id == Driver.id)
        .join(RaceSession, RaceSession.id == SessionResult.session_id)
        .where(RaceSession.year == latest_season, Driver.driver_code.isnot(None))
        .order_by(Driver.driver_code)
        .limit(1)
    )
    if code is None:
        pytest.skip("no driver code available in the configured database")
    return str(code)


@pytest_asyncio.fixture
async def long_history_team(db) -> str:
    """A constructor with many seasons, used for fixed-count assertions."""
    name = await db.scalar(select(Team.name).where(Team.name == "Ferrari").limit(1))
    if name is None:
        pytest.skip("Ferrari is not present in the configured database")
    return str(name)


@pytest_asyncio.fixture
async def short_history_team(db, long_history_team) -> str:
    """The constructor with the fewest distinct seasons of race results."""
    seasons = func.count(func.distinct(RaceSession.year))
    row = (
        await db.execute(
            select(Team.name, seasons)
            .join(SessionResult, SessionResult.team_id == Team.id)
            .join(RaceSession, RaceSession.id == SessionResult.session_id)
            .where(Team.name != long_history_team)
            .group_by(Team.name)
            .order_by(seasons, Team.name)
            .limit(1)
        )
    ).first()
    if row is None:
        pytest.skip("no comparison constructor in the configured database")
    return str(row[0])
