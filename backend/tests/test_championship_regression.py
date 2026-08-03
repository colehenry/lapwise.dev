"""Championship semantics that the standings query rewrite must preserve.

These run against whatever `DATABASE_URL` points at and skip on a database
with no ingested sessions.
"""

from datetime import date

import pytest
from sqlalchemy import func, select

from app.models import (
    ChampionshipClassificationException,
    Driver,
    DriverChampionshipStanding,
)
from app.models import Session as RaceSession
from app.models import SessionResult, Team
from app.services.canonical_standings_service import CanonicalStandingsService

RACE_TYPES = ("race", "sprint_race")


async def _season_with_sessions(db, year: int) -> bool:
    return (
        await db.scalar(select(RaceSession.id).where(RaceSession.year == year).limit(1))
        is not None
    )


async def test_current_season_standings_are_provisional(ingested_data):
    db = ingested_data
    year = date.today().year
    if not await _season_with_sessions(db, year):
        pytest.skip(f"no {year} sessions ingested")

    response = await CanonicalStandingsService.get_season_standings(db, year)

    assert response is not None
    assert response.year == year
    assert [row.classification_status for row in response.drivers] == [
        "provisional"
    ] * len(response.drivers)
    for row in response.drivers:
        assert row.championship_points == row.points_scored


async def test_completed_season_uses_official_classification(ingested_data):
    db = ingested_data
    year = date.today().year - 1
    if not await _season_with_sessions(db, year):
        pytest.skip(f"no {year} sessions ingested")

    response = await CanonicalStandingsService.get_season_standings(db, year)
    assert response is not None

    official = {
        row.driver_id: row
        for row in (
            await db.scalars(
                select(DriverChampionshipStanding).where(
                    DriverChampionshipStanding.year == year
                )
            )
        ).all()
    }
    champion_id = min(official, key=lambda key: official[key].position)
    champion_name = await db.scalar(
        select(Driver.full_name).where(Driver.id == champion_id)
    )

    leader = response.drivers[0]
    assert leader.full_name == champion_name
    assert leader.position == 1
    assert leader.classification_status == "classified"
    assert leader.championship_points == float(
        official[champion_id].championship_points
    )


async def test_points_scored_matches_session_results(ingested_data):
    """On-track points stay a plain sum over race and sprint results."""
    db = ingested_data
    year = await db.scalar(
        select(func.max(RaceSession.year)).where(
            RaceSession.session_type == "sprint_race"
        )
    )
    if year is None:
        pytest.skip("no sprint-era season ingested")

    response = await CanonicalStandingsService.get_season_standings(db, int(year))
    assert response is not None

    expected = {
        name: float(points)
        for name, points in (
            await db.execute(
                select(
                    Driver.full_name, func.coalesce(func.sum(SessionResult.points), 0)
                )
                .join(SessionResult, SessionResult.driver_id == Driver.id)
                .join(RaceSession, RaceSession.id == SessionResult.session_id)
                .where(
                    RaceSession.year == year,
                    RaceSession.session_type.in_(RACE_TYPES),
                )
                .group_by(Driver.full_name)
            )
        ).all()
    }

    assert {row.full_name for row in response.drivers} == set(expected)
    for row in response.drivers:
        assert row.points_scored == pytest.approx(expected[row.full_name])


async def test_position_counts_match_session_results(ingested_data):
    db = ingested_data
    year = int(await db.scalar(select(func.max(RaceSession.year))))
    response = await CanonicalStandingsService.get_season_standings(db, year)
    assert response is not None

    expected: dict[str, dict[int, int]] = {}
    rows = (
        await db.execute(
            select(Driver.full_name, SessionResult.position, func.count())
            .join(SessionResult, SessionResult.driver_id == Driver.id)
            .join(RaceSession, RaceSession.id == SessionResult.session_id)
            .where(
                RaceSession.year == year,
                RaceSession.session_type.in_(RACE_TYPES),
                SessionResult.position.is_not(None),
            )
            .group_by(Driver.full_name, SessionResult.position)
        )
    ).all()
    for name, position, count in rows:
        expected.setdefault(name, {})[int(position)] = int(count)

    for row in response.drivers:
        assert row.position_counts == expected.get(row.full_name, {})
        assert row.wins == expected.get(row.full_name, {}).get(1, 0)
        assert row.p3s == expected.get(row.full_name, {}).get(3, 0)


async def test_listed_team_comes_from_a_scoring_entry(ingested_data):
    db = ingested_data
    year = int(await db.scalar(select(func.max(RaceSession.year))))
    response = await CanonicalStandingsService.get_season_standings(db, year)
    assert response is not None

    entries: dict[str, set[str]] = {}
    rows = (
        await db.execute(
            select(Driver.full_name, Team.name)
            .join(SessionResult, SessionResult.driver_id == Driver.id)
            .join(Team, Team.id == SessionResult.team_id)
            .join(RaceSession, RaceSession.id == SessionResult.session_id)
            .where(
                RaceSession.year == year,
                RaceSession.session_type.in_(RACE_TYPES),
            )
            .distinct()
        )
    ).all()
    for name, team in rows:
        entries.setdefault(name, set()).add(team)

    for row in response.drivers:
        assert row.team_name in entries.get(row.full_name, {"Unknown"})


async def test_classification_exception_removes_position_and_points(ingested_data):
    db = ingested_data
    exception = (
        await db.scalars(
            select(ChampionshipClassificationException)
            .where(ChampionshipClassificationException.entrant_type == "driver")
            .order_by(ChampionshipClassificationException.year.desc())
            .limit(1)
        )
    ).first()
    if exception is None:
        pytest.skip("no driver classification exception ingested")

    name = await db.scalar(
        select(Driver.full_name).where(Driver.id == exception.driver_id)
    )
    response = await CanonicalStandingsService.get_season_standings(db, exception.year)
    assert response is not None

    row = next(row for row in response.drivers if row.full_name == name)
    assert row.position is None
    assert row.championship_points is None
    assert row.classification_status == exception.status
    assert row.scoring_explanation == exception.explanation
