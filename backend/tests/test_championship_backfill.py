from unittest.mock import Mock

from scripts.backfill_canonical_championships import _override_data, _years


def test_missing_only_selects_only_incomplete_snapshots():
    db = Mock()
    db.scalars.side_effect = [
        [1950, 1958, 2026],
        [1950, 1958],
        [1958],
        [1950],
        [1958],
    ]

    assert _years(db, None, missing_only=True) == [2026]


def test_reviewed_overrides_keep_2018_constructor_identities_separate():
    data = _override_data()
    standings = next(
        item
        for item in data["standing_overrides"]
        if item["year"] == 2018 and item["entrant_type"] == "constructor"
    )
    entries = {item["external_id"]: item for item in standings["entries"]}

    assert "force_india" not in entries
    assert entries["racing_point"]["position"] == 7
    assert entries["racing_point"]["points"] == "52"


def test_missing_only_reapplies_reviewed_override_years():
    db = Mock()
    db.scalars.side_effect = [
        [1997, 2018],
        [1997, 2018],
        [1997, 2018],
        [1997, 2018],
        [1997, 2018],
    ]

    assert _years(db, None, missing_only=True) == [1997, 2018]
