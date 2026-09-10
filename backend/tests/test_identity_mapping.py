"""Reviewed alternate-key behavior for ingestion identities."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pandas as pd
import pytest
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session as OrmSession

from app.models import (
    Constructor,
    ConstructorExternalId,
    Driver,
    DriverExternalId,
    DriverSeason,
    IngestIdentityIssue,
    Team,
)
from scripts.ingest.circuits import _stable_circuit_id
from scripts.ingest.identity import resolve_constructor, resolve_driver
from scripts.ingest.participants import apply_participant_identity_override


def _migration_module():
    path = (
        Path(__file__).parents[1]
        / "alembic/versions/e91f6b7c2a10_add_canonical_identity_and_championship.py"
    )
    spec = spec_from_file_location("identity_migration", path)
    assert spec and spec.loader
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Red Bull Racing", "red_bull"),
        ("Cadillac", "cadillac"),
        ("Kick Sauber", "sauber"),
        ("Racing Bulls", "rb"),
        ("Talbot-Lago", "lago"),
        ("Spyker MF1", "spyker_mf1"),
    ],
)
def test_reviewed_constructor_external_ids(name, expected):
    migration = _migration_module()
    assert migration._constructor_key(name, 2026) == expected


def test_unstable_constructor_labels_are_season_scoped():
    migration = _migration_module()
    assert migration._constructor_key("Unknown", 2025) != migration._constructor_key(
        "Unknown", 2026
    )


def test_reviewed_2020_none_team_is_racing_point():
    migration = _migration_module()
    assert migration._constructor_key("None", 2020) == "racing_point"


def test_fastf1_circuit_key_wins_without_network(monkeypatch):
    def unexpected_request(*args, **kwargs):
        raise AssertionError("network must not be used when CircuitId is present")

    monkeypatch.setattr("scripts.ingest.circuits.requests.get", unexpected_request)
    assert _stable_circuit_id({"CircuitId": "monaco"}, 2026, 8) == "monaco"


def test_reviewed_incomplete_fastf1_observation_is_repaired():
    raw = pd.Series(
        {
            "DriverNumber": "25",
            "Abbreviation": "HER",
            "DriverId": None,
            "FullName": "None None",
            "TeamName": None,
            "TeamId": None,
        }
    )

    corrected = apply_participant_identity_override(
        raw,
        year=2026,
        round_num=7,
        session_type="fp1",
    )

    assert corrected["FullName"] == "Colton Herta"
    assert corrected["TeamName"] == "Cadillac"
    assert corrected["TeamId"] == "cadillac"


def test_identity_override_is_scoped_to_exact_session():
    raw = pd.Series({"DriverNumber": "25", "FullName": "None None"})

    unchanged = apply_participant_identity_override(
        raw,
        year=2026,
        round_num=8,
        session_type="fp1",
    )

    assert unchanged["FullName"] == "None None"


# A career that pauses for a decade and resumes is the signature of a
# driver-code collision filing one driver's results under another's row.
# Reviewed exceptions: gaps that are real.
REVIEWED_CAREER_GAPS = {
    # Paddy Driver entered his home Grand Prix in 1963 and again in 1974.
    "driver",
}

# Collisions found and not yet repaired. Each entry is debt: the ratchet
# below fails when one stops exhibiting its gap, so a repair cannot land
# without this list shrinking with it.
UNREPAIRED_IDENTITY_COLLISIONS: set[str] = set()


async def _careers_with_impossible_gaps(db) -> dict[str, list[tuple[int, int]]]:
    # Every session type, not just races. A collision can deposit a practice
    # or sprint-qualifying row on the wrong driver in a year they never
    # started, and filtering to races hides exactly that.
    rows = await db.execute(
        text(
            "SELECT d.slug, array_agg(DISTINCT s.year ORDER BY s.year) AS years"
            " FROM session_results r"
            " JOIN sessions s ON s.id = r.session_id"
            " JOIN drivers d ON d.id = r.driver_id"
            " GROUP BY d.slug"
        )
    )
    found = {}
    for slug, years in rows:
        gaps = [
            (before, after)
            for before, after in zip(years, years[1:])
            if after - before > 10
        ]
        if gaps:
            found[slug] = gaps
    return found


async def test_no_new_driver_identity_collision(ingested_data):
    """A career gap that is neither reviewed nor already known is new debt."""
    found = await _careers_with_impossible_gaps(ingested_data)
    unexpected = set(found) - REVIEWED_CAREER_GAPS - UNREPAIRED_IDENTITY_COLLISIONS

    assert not unexpected, (
        "new driver-code collisions: "
        f"{ {slug: found[slug] for slug in sorted(unexpected)} }"
    )


async def test_unrepaired_collisions_are_still_unrepaired(ingested_data):
    """The ratchet. A repaired collision must be struck from the list rather
    than left behind, or the list stops meaning anything."""
    found = await _careers_with_impossible_gaps(ingested_data)
    repaired = UNREPAIRED_IDENTITY_COLLISIONS - set(found)

    assert not repaired, (
        f"repaired but still listed: {sorted(repaired)} — "
        "remove them from UNREPAIRED_IDENTITY_COLLISIONS"
    )


def _season_registry_session():
    """A minimal driver registry: one canonical driver with a 2026 season entry."""
    engine = create_engine("sqlite://")
    for table in (
        Driver.__table__,
        DriverExternalId.__table__,
        DriverSeason.__table__,
        IngestIdentityIssue.__table__,
    ):
        table.create(engine)

    db = OrmSession(engine)
    driver = Driver(
        slug="russell",
        full_name="George Russell",
        driver_code="RUS",
        driver_number=63,
        jolpica_id="russell",
    )
    db.add(driver)
    db.flush()
    db.add(
        DriverExternalId(driver_id=driver.id, source="jolpica", external_id="russell")
    )
    db.add(
        DriverSeason(
            driver_id=driver.id,
            year=2026,
            driver_code="RUS",
            driver_number=63,
            display_name="George Russell",
        )
    )
    db.commit()
    return db, driver.id


def test_missing_driver_id_resolves_through_the_season_entry():
    """Sprint Qualifying results carry no DriverId. The season's number and code
    must still reach the canonical driver rather than mint a duplicate."""
    db, driver_id = _season_registry_session()

    resolved = resolve_driver(
        db,
        year=2026,
        external_id=None,
        full_name="George Russell",
        driver_code="RUS",
        driver_number=63,
        country_code="GBR",
    )

    assert resolved.id == driver_id
    assert db.execute(select(func.count()).select_from(Driver)).scalar() == 1


def test_unknown_driver_without_driver_id_is_still_provisional():
    """A genuinely new entrant has no season entry and keeps the provisional path."""
    db, driver_id = _season_registry_session()

    resolved = resolve_driver(
        db,
        year=2026,
        external_id=None,
        full_name="Ada Lovelace",
        driver_code="LOV",
        driver_number=99,
        country_code="GBR",
    )

    assert resolved.id != driver_id
    assert db.execute(select(func.count()).select_from(Driver)).scalar() == 2


def _season_team_session():
    """A minimal constructor registry: one canonical team for 2026."""
    engine = create_engine("sqlite://")
    for table in (
        Constructor.__table__,
        ConstructorExternalId.__table__,
        Team.__table__,
        IngestIdentityIssue.__table__,
    ):
        table.create(engine)

    db = OrmSession(engine)
    constructor = Constructor(slug="mercedes", canonical_name="Mercedes")
    db.add(constructor)
    db.flush()
    db.add(
        ConstructorExternalId(
            constructor_id=constructor.id, source="jolpica", external_id="mercedes"
        )
    )
    db.add(
        Team(
            year=2026,
            constructor_id=constructor.id,
            name="Mercedes",
            source_name="Mercedes",
            team_color="00D7B6",
        )
    )
    db.commit()
    return db, constructor.id


def test_missing_team_id_resolves_through_the_season_team():
    """Sprint Qualifying results carry no TeamId. The season's team name must
    still reach the canonical constructor rather than mint a duplicate."""
    db, constructor_id = _season_team_session()

    team = resolve_constructor(
        db,
        year=2026,
        external_id=None,
        source_name="Mercedes",
        display_name="Mercedes",
        color="00D7B6",
    )

    assert team.constructor_id == constructor_id
    assert db.execute(select(func.count()).select_from(Constructor)).scalar() == 1
    assert db.execute(select(func.count()).select_from(Team)).scalar() == 1


def test_unknown_team_without_team_id_is_still_provisional():
    """A genuinely new entrant has no season team and keeps the provisional path."""
    db, constructor_id = _season_team_session()

    team = resolve_constructor(
        db,
        year=2026,
        external_id=None,
        source_name="Analytical Engine",
        display_name="Analytical Engine",
        color="FFFFFF",
    )

    assert team.constructor_id != constructor_id
    assert db.execute(select(func.count()).select_from(Constructor)).scalar() == 2
