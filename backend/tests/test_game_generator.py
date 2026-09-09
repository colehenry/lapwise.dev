"""Board-level sampling budgets, exercised without a database.

The appeal weight and the era budget are pure functions of a header's answer
set and the recognition table, which is what makes them testable here: no
catalog, no pool, no frozen board.
"""

import pytest

from scripts.game_generator import (
    MIN_BOARD_APPEAL,
    RETRO_PIVOT_SEASON,
    Profile,
    board_appeal,
    header_profile,
)
from scripts.game_validator import Recognition


def _named(
    slug: str, wins: int, entries: int, champion: bool, latest_season: int | None
) -> Recognition:
    return Recognition(
        slug=slug,
        full_name=slug.title(),
        wins=wins,
        entries=entries,
        is_champion=champion,
        latest_season=latest_season,
    )


def _recognition(*drivers: Recognition) -> dict[str, Recognition]:
    return {driver.slug: driver for driver in drivers}


def test_a_modern_header_full_of_champions_outweighs_a_retro_one():
    modern = _recognition(
        _named("hamilton", 105, 350, True, 2024),
        _named("verstappen", 60, 200, True, 2024),
    )
    retro = _recognition(
        _named("alboreto", 5, 194, False, 1994),
        _named("patrese", 6, 256, False, 1993),
    )
    assert (
        header_profile({"hamilton", "verstappen"}, modern).appeal
        > header_profile({"alboreto", "patrese"}, retro).appeal
    )


def test_fame_and_recency_are_each_penalised_on_their_own():
    """Multiplied rather than averaged, so a header must clear both."""
    champions = _recognition(
        _named("senna", 41, 161, True, 1994),
        _named("prost", 51, 199, True, 1993),
    )
    recent_unknowns = _recognition(
        _named("latifi", 0, 61, False, 2022),
        _named("mazepin", 0, 21, False, 2021),
    )
    both = _recognition(
        _named("hamilton", 105, 350, True, 2024),
        _named("verstappen", 60, 200, True, 2024),
    )
    famous_but_old = header_profile({"senna", "prost"}, champions).appeal
    recent_but_unknown = header_profile({"latifi", "mazepin"}, recent_unknowns).appeal
    strong = header_profile({"hamilton", "verstappen"}, both).appeal
    assert famous_but_old < strong
    assert recent_but_unknown < strong


def test_a_header_with_no_recognised_answers_falls_to_the_floor():
    profile = header_profile({"nobody"}, {})
    assert profile.median_season is None
    assert not profile.is_retro
    assert profile.appeal > 0


def test_the_retro_flag_reads_the_median_not_the_extremes():
    """One recent answer does not make a 1990s header modern."""
    mixed = _recognition(
        _named("hill", 22, 116, True, 1999),
        _named("berger", 10, 210, False, 1997),
        _named("alonso", 32, 400, True, 2025),
    )
    assert header_profile({"hill", "berger", "alonso"}, mixed).is_retro


def test_the_retro_boundary_sits_on_the_pivot_season():
    on_pivot = Profile(appeal=1.0, median_season=RETRO_PIVOT_SEASON)
    below = Profile(appeal=1.0, median_season=RETRO_PIVOT_SEASON - 1)
    assert not on_pivot.is_retro
    assert below.is_retro


def test_board_appeal_is_the_mean_across_every_header():
    profiles = {
        "a": Profile(appeal=3.0, median_season=2020),
        "b": Profile(appeal=1.0, median_season=2015),
        "c": Profile(appeal=0.2, median_season=1995),
    }
    assert board_appeal(["a", "b", "c"], profiles) == pytest.approx(1.4)


def test_a_board_of_weak_headers_falls_below_the_board_budget():
    """The failure the budget exists for: six individually legal headers."""
    profiles = {
        slug: Profile(appeal=0.3, median_season=2012)
        for slug in ("a", "b", "c", "d", "e", "f")
    }
    assert board_appeal(list(profiles), profiles) < MIN_BOARD_APPEAL
