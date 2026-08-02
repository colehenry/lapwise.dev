import pytest

from scripts.ingest.team_colors import normalize_team_name


@pytest.fixture(autouse=True)
async def cleanup_test_data():
    """Override the database cleanup fixture: these mapping tests are pure units."""
    yield


def test_2026_team_id_overrides_unstable_display_name():
    assert (
        normalize_team_name("Red Bull", year=2026, team_id="red_bull")
        == "Red Bull Racing"
    )
    assert normalize_team_name("RB F1 Team", year=2026, team_id="rb") == "Racing Bulls"
    assert (
        normalize_team_name("Alpine F1 Team", year=2026, team_id="alpine") == "Alpine"
    )
    assert (
        normalize_team_name("Cadillac F1 Team", year=2026, team_id="cadillac")
        == "Cadillac"
    )


def test_2026_team_id_map_has_exactly_the_current_grid():
    team_ids = {
        "alpine",
        "aston_martin",
        "audi",
        "cadillac",
        "ferrari",
        "haas",
        "mclaren",
        "mercedes",
        "rb",
        "red_bull",
        "williams",
    }

    names = {
        normalize_team_name(team_id, year=2026, team_id=team_id) for team_id in team_ids
    }

    assert len(names) == 11


def test_pre_2026_team_name_mapping_is_unchanged():
    assert normalize_team_name("Audi", year=2025, team_id="audi") == "Audi"
    assert normalize_team_name("Red Bull", year=2025) == "Red Bull Racing"
