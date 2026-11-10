"""Most points one entrant can still take from a round, by era.

A clinch is only as trustworthy as the maximum it is measured against, and that
maximum has changed eight times. Seasons scored on a driver's best N results are
excluded outright: deciding when a title became safe under a dropping rule means
replaying the whole season under it, and a wrong trophy is worse than none.
"""

from dataclasses import dataclass

# Until 1991 only a driver's best N results counted. See
# docs/championship-scoring-rules.md for the seasons this affects.
FIRST_SUMMED_SEASON = 1991


@dataclass(frozen=True)
class RoundMaximum:
    """Most one driver and one team can score in a single round."""

    driver_grand_prix: int
    driver_sprint: int
    team_grand_prix: int
    team_sprint: int


def _maximum(
    win: int, second: int, fastest_lap: int, sprint: tuple[int, int]
) -> RoundMaximum:
    """A team's haul is a 1-2 finish; only one car can set the fastest lap."""
    sprint_win, sprint_second = sprint
    return RoundMaximum(
        driver_grand_prix=win + fastest_lap,
        driver_sprint=sprint_win,
        team_grand_prix=win + second + fastest_lap,
        team_sprint=sprint_win + sprint_second,
    )


NO_SPRINT = (0, 0)

# First season the award table applied, newest first.
_ERAS: tuple[tuple[int, RoundMaximum], ...] = (
    # The fastest-lap bonus was removed again from 2025.
    (2025, _maximum(25, 18, 0, (8, 7))),
    # 2022 widened the sprint to the top eight; 2019 added the fastest-lap point.
    (2022, _maximum(25, 18, 1, (8, 7))),
    (2021, _maximum(25, 18, 1, (3, 2))),
    (2019, _maximum(25, 18, 1, NO_SPRINT)),
    (2010, _maximum(25, 18, 0, NO_SPRINT)),
    (2003, _maximum(10, 8, 0, NO_SPRINT)),
    (FIRST_SUMMED_SEASON, _maximum(10, 6, 0, NO_SPRINT)),
)


def round_maximum(year: int) -> RoundMaximum | None:
    """The award table in force, or None when the season's rules bar a clinch."""
    for first_year, maximum in _ERAS:
        if year >= first_year:
            return maximum
    return None
