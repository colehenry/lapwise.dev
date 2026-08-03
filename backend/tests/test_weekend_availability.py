"""Race-weekend availability metadata across weekend shapes."""

import pytest
from sqlalchemy import func, select

from app.models import Session as RaceSession
from app.services.weekend_service import WeekendService

from .perf.statement_counter import count_statements


async def _round_with_type(db, session_type: str):
    row = (
        await db.execute(
            select(RaceSession.year, RaceSession.round)
            .where(RaceSession.session_type == session_type)
            .order_by(RaceSession.year.desc(), RaceSession.round.desc())
            .limit(1)
        )
    ).first()
    if row is None:
        pytest.skip(f"no {session_type} session ingested")
    return int(row[0]), int(row[1])


async def test_standard_weekend_lists_race_and_qualifying(ingested_data):
    db = ingested_data
    season, round_number = await _round_with_type(db, "fp3")

    availability = await WeekendService.get_round_availability(db, season, round_number)

    assert availability is not None
    assert availability.season == season
    assert availability.round == round_number
    assert "race" in availability.session_types
    assert "qualifying" in availability.session_types
    assert availability.practice_numbers == sorted(availability.practice_numbers)
    assert availability.event_name
    assert availability.circuit_name


async def test_sprint_weekend_is_marked(ingested_data):
    db = ingested_data
    season, round_number = await _round_with_type(db, "sprint_race")

    availability = await WeekendService.get_round_availability(db, season, round_number)

    assert availability is not None
    assert availability.has_sprint is True
    assert "sprint_race" in availability.session_types


async def test_historical_weekend_offers_no_practice(ingested_data):
    db = ingested_data
    year = await db.scalar(select(func.min(RaceSession.year)))
    availability = await WeekendService.get_round_availability(db, int(year), 1)

    assert availability is not None
    assert availability.session_types == ["race"]
    assert availability.practice_numbers == []
    assert availability.has_sprint is False


async def test_unknown_round_has_no_availability(ingested_data):
    db = ingested_data
    year = int(await db.scalar(select(func.max(RaceSession.year))))

    assert await WeekendService.get_round_availability(db, year, 99) is None


async def test_availability_is_a_fixed_two_statement_read(ingested_data):
    db = ingested_data
    season, round_number = await _round_with_type(db, "race")

    with count_statements() as counter:
        availability = await WeekendService.get_round_availability(
            db, season, round_number
        )

    assert availability is not None
    assert counter.count <= 2, counter.report()
