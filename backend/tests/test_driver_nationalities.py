"""Nationality vocabulary and backfill classification behavior."""

import json
import re
from pathlib import Path

import pytest

from app.nationality import (
    LAPWISE_CODES,
    normalize_country_code,
    normalize_demonym,
)
from scripts.backfill_driver_nationalities import blocking, classify

FLAGS_PATH = Path(__file__).parents[2] / "frontend/lib/flags.ts"
OVERRIDES_PATH = Path(__file__).parents[1] / "data/driver_nationality_overrides.json"


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeDb:
    """Stands in for the driver query in `classify`."""

    def __init__(self, rows):
        self._rows = rows

    def execute(self, _statement):
        return _Result(self._rows)


def _classify(rows, resolved, overrides=None):
    return classify(_FakeDb(rows), resolved, overrides or {})


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("NLD", "NED"),
        ("DEU", "GER"),
        ("CHE", "SUI"),
        ("MCO", "MON"),
        ("DNK", "DEN"),
        ("ZAF", "RSA"),
        ("PRT", "POR"),
        ("URY", "URU"),
        ("MYS", "MAL"),
        ("RSR", "RHO"),
        ("GBR", "GBR"),
        ("USA", "USA"),
        ("ned", "NED"),
        (" GBR ", "GBR"),
        ("XXX", None),
        ("", None),
        (None, None),
    ],
)
def test_country_code_normalization(raw, expected):
    assert normalize_country_code(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("British", "GBR"),
        ("Dutch", "NED"),
        ("German", "GER"),
        ("East German", "GER"),
        ("American", "USA"),
        ("Monegasque", "MON"),
        ("Swiss", "SUI"),
        ("Rhodesian", "RHO"),
        ("Liechtensteiner", "LIE"),
        ("New Zealander", "NZL"),
        ("south african", "RSA"),
        ("Martian", None),
        (None, None),
    ],
)
def test_demonym_normalization(raw, expected):
    assert normalize_demonym(raw) == expected


def test_frontend_renders_every_stored_code():
    """`frontend/lib/flags.ts` must cover exactly the backend vocabulary."""
    source = FLAGS_PATH.read_text()
    table = source.split("const DRIVER_COUNTRIES", 1)[1].split("};", 1)[0]
    entries = re.findall(
        r"^\s{2}([A-Z]{3}): \{ alpha2: \"([A-Z]{2})\", name: \"([^\"]+)\" \},$",
        table,
        re.MULTILINE,
    )
    assert {code for code, _, _ in entries} == set(LAPWISE_CODES)
    assert all(name and name != code for code, _, name in entries)


def test_overrides_are_reviewed_exceptions():
    entries = json.loads(OVERRIDES_PATH.read_text())["overrides"]
    references = [entry["jolpica_id"] for entry in entries]
    assert len(references) == len(set(references))
    for entry in entries:
        assert entry["country_code"] in LAPWISE_CODES
        assert entry["source"].startswith("https://")
        assert entry["reason"]


def test_matches_only_through_the_jolpica_mapping():
    """A driver without an external-ID row is never matched by name or code."""
    rows = [(1, "Ayrton Senna", None, None)]
    buckets = _classify(rows, {"senna": ("BRA", "BRA", "Brazilian")})
    assert [entry[0] for entry in buckets["unmapped"]] == [1]
    assert buckets["fillable"] == []


def test_fills_missing_and_leaves_matching_values_alone():
    rows = [
        (1, "Max Verstappen", None, "max_verstappen"),
        (2, "Lewis Hamilton", "GBR", "hamilton"),
    ]
    buckets = _classify(
        rows,
        {
            "max_verstappen": ("NED", "NLD", "Dutch"),
            "hamilton": ("GBR", "GBR", "British"),
        },
    )
    assert [(e[0], e[4]) for e in buckets["fillable"]] == [(1, "NED")]
    assert [e[0] for e in buckets["unchanged"]] == [2]


def test_conflicting_value_is_reported_not_overwritten():
    rows = [(1, "Jean-Éric Vergne", "NED", "vergne")]
    buckets = _classify(rows, {"vergne": ("FRA", "FRA", "French")})
    assert buckets["fillable"] == []
    assert [(e[0], e[2], e[4]) for e in buckets["conflicting"]] == [(1, "NED", "FRA")]


def test_override_resolves_a_conflict():
    rows = [(1, "Jean-Éric Vergne", "NED", "vergne")]
    overrides = {"vergne": {"jolpica_id": "vergne", "country_code": "FRA"}}
    buckets = _classify(rows, {"vergne": ("FRA", "FRA", "French")}, overrides)
    assert buckets["conflicting"] == []
    assert [(e[0], e[4]) for e in buckets["fillable"]] == [(1, "FRA")]


def test_override_beats_the_source_value():
    rows = [(1, "Reviewed Driver", None, "reviewed")]
    overrides = {"reviewed": {"jolpica_id": "reviewed", "country_code": "MON"}}
    buckets = _classify(rows, {"reviewed": ("FRA", "FRA", "French")}, overrides)
    assert [(e[0], e[4]) for e in buckets["fillable"]] == [(1, "MON")]


def test_unresolvable_source_value_stays_null():
    rows = [(1, "Unknown Nation", None, "unknown")]
    buckets = _classify(rows, {"unknown": (None, "XXX", None)})
    assert [e[0] for e in buckets["unresolved"]] == [1]
    assert buckets["fillable"] == []


def test_rerun_after_apply_reports_no_changes():
    resolved = {"max_verstappen": ("NED", "NLD", "Dutch")}
    first = _classify([(1, "Max Verstappen", None, "max_verstappen")], resolved)
    applied = [(1, "Max Verstappen", first["fillable"][0][4], "max_verstappen")]
    second = _classify(applied, resolved)
    assert second["fillable"] == []
    assert [e[0] for e in second["unchanged"]] == [1]


def test_apply_blocks_only_on_game_eligible_exceptions():
    rows = [
        (1, "Pool Conflict", "NED", "vergne"),
        (2, "Historic Conflict", "NED", "old_driver"),
    ]
    resolved = {
        "vergne": ("FRA", "FRA", "French"),
        "old_driver": ("ITA", "ITA", "Italian"),
    }
    buckets = _classify(rows, resolved)
    assert [entry[0] for entry in blocking(buckets, {1})] == [1]
    assert blocking(buckets, set()) == []
