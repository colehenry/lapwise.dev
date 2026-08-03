"""Reviewed alternate-key behavior for ingestion identities."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest
import pandas as pd

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
