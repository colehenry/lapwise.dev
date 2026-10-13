"""Replay discovery matches playback, bounds fallback, and notices ingestion."""

from datetime import date

import pytest
from sqlalchemy import delete

from app.config import settings
from app.models import (
    Circuit,
    CircuitVenue,
    Constructor,
    Driver,
    Lap,
    SessionResult,
    Team,
)
from app.models import Session as RaceSession
from app.services.console_availability_service import console_availability
from scripts.ingest.utils import get_db_session
from tests.perf.statement_counter import count_statements


@pytest.fixture
def availability_rows():
    with get_db_session() as db:
        venue = CircuitVenue(
            slug="availability-venue",
            canonical_name="Test",
            location="Test",
            country="Test",
        )
        constructor = Constructor(
            slug="availability-constructor", canonical_name="Test"
        )
        drivers = [
            Driver(
                slug=f"availability-driver-{i}",
                full_name=f"Test {i}",
                driver_code=f"T{i}",
            )
            for i in range(2)
        ]
        db.add_all([venue, constructor, *drivers])
        db.flush()
        circuit = Circuit(
            venue_id=venue.id,
            layout_slug="availability-layout",
            name="Test",
            location="Test",
            country="Test",
        )
        team = Team(year=2040, constructor_id=constructor.id, name="Test")
        db.add_all([circuit, team])
        db.flush()
        race_ids = []

        def race(
            round_num, timed_laps=0, *, year=2040, classified=True, driver_index=0
        ):
            session = RaceSession(
                year=year,
                round=round_num,
                session_type="race",
                event_name="Test",
                date=date(year, 1, round_num),
                circuit_id=circuit.id,
            )
            db.add(session)
            db.flush()
            race_ids.append(session.id)
            if classified:
                db.add(
                    SessionResult(
                        session_id=session.id,
                        driver_id=drivers[driver_index].id,
                        team_id=team.id,
                        status="Finished",
                        position=1,
                    )
                )
            for number in range(1, timed_laps + 1):
                db.add(
                    Lap(
                        session_id=session.id,
                        driver_id=drivers[driver_index].id,
                        lap_number=number,
                        lap_start_time_seconds=number * 90,
                        lap_time_seconds=90,
                    )
                )
            db.commit()
            return session

        try:
            yield db, race, drivers, team
        finally:
            db.rollback()
            db.execute(delete(RaceSession).where(RaceSession.id.in_(race_ids)))
            for model, rows in [
                (Team, [team]),
                (Driver, drivers),
                (Circuit, [circuit]),
                (Constructor, [constructor]),
                (CircuitVenue, [venue]),
            ]:
                db.execute(delete(model).where(model.id.in_([row.id for row in rows])))
            db.commit()


async def test_discovery_skips_unusable_laps_and_unpublished_sessions(
    availability_rows, db_session
):
    db, race, drivers, _ = availability_rows
    selected = race(5, 4)
    race(6, 3)
    latest = race(7)
    db.add_all(
        [
            Lap(session_id=latest.id, driver_id=drivers[0].id, lap_number=i)
            for i in range(1, 5)
        ]
    )
    db.commit()
    race(8, 4, classified=False)
    with count_statements() as counter:
        result = await console_availability(db_session)
    assert result.latest.round == 7
    assert result.replay.round == 5
    assert result.replay.revision.startswith(f"{selected.id}-4-")
    assert counter.count == 3, counter.report()
    assert not counter.matching("replay_data"), counter.report()
    assert not counter.matching("lap_time_seconds"), counter.report()


async def test_four_laps_must_belong_to_one_classified_driver(
    availability_rows, db_session
):
    db, race, drivers, team = availability_rows
    session = race(1, 2)
    db.add(
        SessionResult(
            session_id=session.id,
            driver_id=drivers[1].id,
            team_id=team.id,
            status="Finished",
            position=2,
        )
    )
    db.add_all(
        [
            Lap(
                session_id=session.id,
                driver_id=drivers[1].id,
                lap_number=i,
                lap_start_time_seconds=i * 90,
            )
            for i in range(1, 3)
        ]
    )
    db.commit()
    assert (await console_availability(db_session)).replay is None


async def test_fallback_is_bounded_and_never_crosses_seasons(
    availability_rows, db_session
):
    _, race, _, _ = availability_rows
    race(1, 4, year=2039)
    race(15, 4)
    race(20)
    result = await console_availability(db_session)
    assert result.latest.round == 20
    assert result.season == 2040
    assert result.replay is None


async def test_new_laps_change_selection_and_revision(availability_rows, db_session):
    db, race, drivers, _ = availability_rows
    race(1, 4)
    latest = race(2, 3)
    assert (await console_availability(db_session)).replay.round == 1
    db.add(
        Lap(
            session_id=latest.id,
            driver_id=drivers[0].id,
            lap_number=4,
            lap_start_time_seconds=360,
        )
    )
    db.commit()
    first = (await console_availability(db_session)).replay
    assert first.round == 2
    db.add(
        Lap(
            session_id=latest.id,
            driver_id=drivers[0].id,
            lap_number=5,
            lap_start_time_seconds=450,
        )
    )
    db.commit()
    assert (await console_availability(db_session)).replay.revision != first.revision


async def test_discovery_is_short_lived_and_missing_geometry_is_not_cached(
    availability_rows, client
):
    _, race, _, _ = availability_rows
    race(1, 4)
    headers = {"X-API-Key": settings.lapwise_api_key}
    response = await client.get("/api/replay/console/availability", headers=headers)
    assert response.status_code == 200
    assert (
        response.headers["cache-control"]
        == "public, max-age=60, stale-while-revalidate=0"
    )
    assert "X-API-Key" in response.headers["vary"]
    replay = await client.get("/api/replay/console/2040/1/v3", headers=headers)
    assert replay.status_code == 200 and replay.json()["track"] is None
    assert replay.headers["cache-control"] == "private, no-store"
    missing = await client.get("/api/replay/console/2040/99/v3", headers=headers)
    assert missing.status_code == 404
    assert missing.headers["cache-control"] == "private, no-store"


async def test_empty_archive_is_a_successful_explicit_empty_state(monkeypatch, client):
    async def no_latest(db):
        return None

    monkeypatch.setattr(
        "app.services.console_availability_service.latest_race", no_latest
    )
    response = await client.get(
        "/api/replay/console/availability",
        headers={"X-API-Key": settings.lapwise_api_key},
    )
    assert response.status_code == 200
    assert response.json() == {"season": None, "latest": None, "replay": None}


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
async def test_nonfinite_starts_are_not_playable(availability_rows, db_session, value):
    db, race, drivers, _ = availability_rows
    session = race(1, 3)
    db.add(
        Lap(
            session_id=session.id,
            driver_id=drivers[0].id,
            lap_number=4,
            lap_start_time_seconds=value,
        )
    )
    db.commit()
    assert (await console_availability(db_session)).replay is None
