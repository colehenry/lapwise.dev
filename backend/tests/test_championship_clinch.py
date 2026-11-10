"""The clinch arithmetic, on the cases that decide whether it can be trusted."""

from app.championship_scoring import round_maximum
from app.services.championship_clinch_service import (
    SeasonShape,
    clinched_round,
    pivot_cumulative,
    season_shape,
)

ANTONELLI = 1
VERSTAPPEN = 2
RUSSELL = 3

# 2026 ran 23 rounds with sprints on 2, 4, 5, 9, 12 and 17, so nothing but
# 25-point Grands Prix remained once the field reached Austin.
SEASON_2026 = SeasonShape(total_rounds=23, sprint_rounds=frozenset({2, 4, 5, 9, 12, 17}))


def clinch(cumulative, year=2026, shape=SEASON_2026, entrant="driver", champion=None):
    return clinched_round(
        cumulative, year=year, shape=shape, entrant=entrant, official_champion_id=champion
    )


def test_a_gap_smaller_than_the_points_left_is_not_a_clinch():
    """Austin 2026: 123 ahead with 125 still available, so two points short."""
    assert clinch({18: {ANTONELLI: 365.0, RUSSELL: 242.0}}) is None


def test_a_gap_larger_than_the_points_left_clinches():
    """Mexico City 2026: 119 ahead with four rounds and 100 points left."""
    assert clinch({19: {ANTONELLI: 380.0, VERSTAPPEN: 261.0}}) == (19, ANTONELLI)


def test_the_earliest_qualifying_round_is_the_clinch():
    cumulative = {
        18: {ANTONELLI: 365.0, RUSSELL: 242.0},
        19: {ANTONELLI: 380.0, VERSTAPPEN: 261.0},
        20: {ANTONELLI: 405.0, VERSTAPPEN: 280.0},
    }

    assert clinch(cumulative) == (19, ANTONELLI)


def test_a_gap_exactly_equal_to_the_points_left_is_not_a_clinch():
    """A tie on points goes to win countback, which this does not predict."""
    assert clinch({19: {ANTONELLI: 361.0, VERSTAPPEN: 261.0}}) is None
    assert clinch({19: {ANTONELLI: 361.5, VERSTAPPEN: 261.0}}) == (19, ANTONELLI)


def test_remaining_sprints_raise_the_bar():
    """The same gap clinches without a sprint left and does not with one."""
    # 276 clear with eleven Grands Prix (275 points) left, but one sprint more
    # on the calendar puts 283 in reach and the title back in play.
    gap = {12: {ANTONELLI: 377.0, VERSTAPPEN: 101.0}}
    no_sprints = SeasonShape(total_rounds=23, sprint_rounds=frozenset())

    assert clinch(gap, shape=no_sprints) == (12, ANTONELLI)
    assert clinch(gap, shape=SEASON_2026) is None


def test_a_season_scored_on_best_results_reports_no_clinch():
    """Before 1991 a title turned on which results counted, not the sum."""
    runaway = {10: {ANTONELLI: 400.0, VERSTAPPEN: 0.0}}

    assert clinch(runaway, year=1990) is None
    assert clinch(runaway, year=1991) == (10, ANTONELLI)


def test_the_official_champion_overrides_the_arithmetic():
    """Summed points naming someone else means the sum is wrong, not the record."""
    settled = {19: {ANTONELLI: 380.0, VERSTAPPEN: 261.0}}

    assert clinch(settled, champion=ANTONELLI) == (19, ANTONELLI)
    assert clinch(settled, champion=VERSTAPPEN) is None


def test_a_lone_entrant_cannot_clinch():
    assert clinch({19: {ANTONELLI: 380.0}}) is None


def test_constructors_measure_against_a_one_two_finish():
    """A team can take 43 from a Grand Prix, so the bar is far higher."""
    gap = {19: {ANTONELLI: 630.0, VERSTAPPEN: 504.0}}

    assert clinch(gap, entrant="constructor") is None
    assert clinch(gap, entrant="driver") == (19, ANTONELLI)


def test_the_fastest_lap_era_leaves_an_extra_point_on_the_table():
    assert round_maximum(2024).driver_grand_prix == 26
    assert round_maximum(2025).driver_grand_prix == 25
    assert round_maximum(2021).driver_sprint == 3
    assert round_maximum(2022).driver_sprint == 8
    assert round_maximum(1990) is None


def test_a_finished_season_is_measured_by_its_own_results():
    """Only the running season needs a calendar; a finished one is its own."""
    shape = season_shape(2024, observed_total=24, observed_sprints=[5, 6])

    assert shape == SeasonShape(total_rounds=24, sprint_rounds=frozenset({5, 6}))


def test_a_season_with_no_results_has_no_shape():
    assert season_shape(2026, observed_total=None, observed_sprints=None) is None


def test_a_missed_round_carries_the_last_total_forward():
    """An entrant absent from a round still holds the points they had."""
    pivoted = pivot_cumulative(
        {ANTONELLI: {"1": 25.0, "2": 43.0}, VERSTAPPEN: {"1": 18.0}}
    )

    assert pivoted[2] == {ANTONELLI: 43.0, VERSTAPPEN: 18.0}
