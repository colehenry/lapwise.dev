"""Reviewed alternate-key behavior for ingestion identities."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pandas as pd
import pytest
from sqlalchemy import text

from scripts.ingest.circuits import _stable_circuit_id
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
