"""The round at which a championship stopped being winnable by anyone else.

The test is `gap > most the nearest rival can still score`, applied round by
round. It is strictly greater: an exact tie on points goes to win countback, and
projected wins are not something this can know. The cost is naming the clinch one
round later than a countback would in that rare case, which is the right way to
be wrong.

The predicate is monotone for the eventual champion — once nobody can catch them,
nobody can catch them at a later round — so the first round that satisfies it is
the clinch.
"""

import logging
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from typing import Mapping

import fastf1
from sqlalchemy import String, cast, func, select

from app.championship_scoring import RoundMaximum, round_maximum
from app.models import (
    ConstructorChampionshipStanding,
    Driver,
    DriverChampionshipStanding,
    Session,
    SessionResult,
    Team,
)

logger = logging.getLogger(__name__)

RACE_TYPES = ("race", "sprint_race")


@dataclass(frozen=True)
class SeasonShape:
    """How many rounds a season holds, and which of them carry a sprint."""

    total_rounds: int
    sprint_rounds: frozenset[int]


def season_shape(
    year: int, *, observed_total: int | None, observed_sprints: list[int] | None
) -> SeasonShape | None:
    """How long the season is and where its sprints fall.

    A finished season's own results are the authority on its length. A season
    still running does not know its remaining rounds, so the published calendar
    answers for it — and when that cannot be read, falling back to observed
    results reports no clinch until the final round has been ingested.
    """
    if not observed_total:
        return None
    observed = SeasonShape(
        total_rounds=observed_total, sprint_rounds=frozenset(observed_sprints or ())
    )
    if year < date.today().year:
        return observed
    return scheduled_shape(year) or observed


def observed_shape_columns(season: int):
    """Season length and sprint rounds, as scalar subqueries to fold into a statement."""
    total = (
        select(func.max(Session.round))
        .where(Session.year == season, Session.session_type.in_(RACE_TYPES))
        .scalar_subquery()
    )
    sprints = (
        select(func.array_agg(func.distinct(Session.round)))
        .where(Session.year == season, Session.session_type == "sprint_race")
        .scalar_subquery()
    )
    return total, sprints


@lru_cache(maxsize=None)
def scheduled_shape(year: int) -> SeasonShape | None:
    """Season length and sprint rounds from the published calendar.

    Only the running season needs this: a completed season's own results say how
    long it was, while a season mid-flight does not know its own remaining
    rounds. Returns None when the calendar cannot be read, which leaves the
    caller on observed results and so reports no clinch until the season ends.
    """
    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)
    except Exception as exc:  # noqa: BLE001 — any failure means "no calendar"
        logger.warning("No %s calendar available for clinch maths: %s", year, exc)
        return None
    rounds = [int(event.RoundNumber) for event in schedule.itertuples()]
    if not rounds:
        return None
    sprints = {
        int(event.RoundNumber)
        for event in schedule.itertuples()
        if "sprint" in str(event.EventFormat).lower()
    }
    return SeasonShape(total_rounds=max(rounds), sprint_rounds=frozenset(sprints))


def clinched_round(
    cumulative: Mapping[int, Mapping[int, float]],
    *,
    year: int,
    shape: SeasonShape,
    entrant: str,
    official_champion_id: int | None = None,
) -> tuple[int, int] | None:
    """First round where one entrant could no longer be caught.

    `cumulative` maps round number to each entrant's running total after it.
    Returns `(round, entrant_id)`, or None when the season's scoring rules bar
    the calculation, nobody has clinched, or the arithmetic disagrees with the
    official champion.
    """
    maximum = round_maximum(year)
    if maximum is None:
        return None

    for round_number in sorted(cumulative):
        totals = cumulative[round_number]
        if len(totals) < 2:
            continue
        leader_id, leader_points = max(totals.items(), key=lambda item: item[1])
        rival_points = max(
            points for entity_id, points in totals.items() if entity_id != leader_id
        )
        remaining = _remaining(maximum, entrant, round_number, shape)
        if leader_points - rival_points > remaining:
            if official_champion_id is not None and leader_id != official_champion_id:
                # Summed points name someone the official classification does
                # not. Say nothing rather than crown the wrong entrant.
                logger.warning(
                    "%s %s clinch disagrees with official champion; skipping",
                    year,
                    entrant,
                )
                return None
            return round_number, leader_id
    return None


async def clinched_champion(
    db, year: int, entrant: str = "driver"
) -> tuple[int, int] | None:
    """Round and entrant id of one season's clinch, in a single statement.

    For callers that hold no standings of their own — a career title count, say,
    which needs to know whether the season still running has been settled.
    """
    if entrant == "constructor":
        owner, result_owner = Team.id, SessionResult.team_id
        model, model_owner = (
            ConstructorChampionshipStanding,
            ConstructorChampionshipStanding.team_id,
        )
    else:
        owner, result_owner = Driver.id, SessionResult.driver_id
        model, model_owner = (
            DriverChampionshipStanding,
            DriverChampionshipStanding.driver_id,
        )

    cumulative = cumulative_by_round_subquery(owner, result_owner, year)
    observed_total, observed_sprints = observed_shape_columns(year)
    champion = (
        select(model_owner)
        .where(model.year == year, model.position == 1)
        .scalar_subquery()
    )
    rows = (
        await db.execute(
            select(
                cumulative.c.owner_id,
                cumulative.c.cumulative,
                observed_total.label("observed_total"),
                observed_sprints.label("observed_sprints"),
                champion.label("champion"),
            ).select_from(cumulative)
        )
    ).all()
    if not rows:
        return None
    shape = season_shape(
        year,
        observed_total=rows[0].observed_total,
        observed_sprints=rows[0].observed_sprints,
    )
    if shape is None:
        return None
    return clinched_round(
        pivot_cumulative({row.owner_id: row.cumulative for row in rows}),
        year=year,
        shape=shape,
        entrant=entrant,
        official_champion_id=rows[0].champion,
    )


def clinch_from_progression(
    progressions: Mapping[int, list],
    *,
    year: int,
    all_sessions: list[tuple[int, str, str]],
    official_positions: Mapping[int, int],
    entrant: str,
) -> tuple[int, int] | None:
    """Clinch read off progressions already built, costing no further query.

    A progression point keyed by a bare round number is the total after that
    whole weekend, sprint included, so the clinch lands on the round rather than
    the session inside it.
    """
    shape = season_shape(
        year,
        observed_total=max((round_ for round_, _, _ in all_sessions), default=0),
        observed_sprints=[
            round_ for round_, _, kind in all_sessions if kind == "sprint_race"
        ],
    )
    if shape is None:
        return None
    cumulative: dict[int, dict[int, float]] = {}
    for entity_id, points in progressions.items():
        for point in points:
            if point.round.isdigit() and int(point.round) > 0:
                cumulative.setdefault(int(point.round), {})[entity_id] = (
                    point.cumulative_points
                )
    champion = next(
        (key for key, position in official_positions.items() if position == 1), None
    )
    return clinched_round(
        cumulative,
        year=year,
        shape=shape,
        entrant=entrant,
        official_champion_id=champion,
    )


def _remaining(
    maximum: RoundMaximum, entrant: str, after_round: int, shape: SeasonShape
) -> int:
    """Most one entrant can still score across the rounds that follow."""
    grand_prix = max(0, shape.total_rounds - after_round)
    sprints = len([round_ for round_ in shape.sprint_rounds if round_ > after_round])
    if entrant == "constructor":
        return grand_prix * maximum.team_grand_prix + sprints * maximum.team_sprint
    return grand_prix * maximum.driver_grand_prix + sprints * maximum.driver_sprint


def cumulative_by_round_subquery(owner_column, result_owner_column, season: int):
    """One row per entrant holding a JSON map of round to running points total.

    Shaped to travel inside an existing statement, so reading the clinch costs
    no extra round trip.
    """
    per_round = (
        select(
            owner_column.label("owner_id"),
            Session.round.label("round"),
            func.sum(func.coalesce(SessionResult.points, 0)).label("points"),
        )
        .join(SessionResult, owner_column == result_owner_column)
        .join(Session, SessionResult.session_id == Session.id)
        .where(Session.year == season, Session.session_type.in_(RACE_TYPES))
        .group_by(owner_column, Session.round)
        .subquery()
    )
    running = select(
        per_round.c.owner_id,
        per_round.c.round,
        func.sum(per_round.c.points)
        .over(partition_by=per_round.c.owner_id, order_by=per_round.c.round)
        .label("running"),
    ).subquery()
    return (
        select(
            running.c.owner_id,
            func.jsonb_object_agg(
                cast(running.c.round, String), running.c.running
            ).label("cumulative"),
        )
        .group_by(running.c.owner_id)
        .subquery()
    )


def pivot_cumulative(
    rows: Mapping[int, Mapping[str, float] | None],
) -> dict[int, dict[int, float]]:
    """Turn per-entrant round maps into round-keyed tables of every entrant.

    A round only counts once every entrant has a total for it, which is what
    `jsonb_object_agg` gives: an entrant who missed a round carries no key for
    it, so their last known total is forward-filled here.
    """
    pivoted: dict[int, dict[int, float]] = {}
    for entity_id, by_round in rows.items():
        if not by_round:
            continue
        for key, total in by_round.items():
            pivoted.setdefault(int(key), {})[entity_id] = float(total)
    _forward_fill(pivoted, set(rows))
    return pivoted


def _forward_fill(pivoted: dict[int, dict[int, float]], entity_ids: set[int]) -> None:
    """Carry an entrant's last total into rounds they did not score in."""
    last: dict[int, float] = {}
    for round_number in sorted(pivoted):
        totals = pivoted[round_number]
        for entity_id in entity_ids:
            if entity_id in totals:
                last[entity_id] = totals[entity_id]
            elif entity_id in last:
                totals[entity_id] = last[entity_id]


async def driver_title_years(db, driver_id: int) -> list[int]:
    """Seasons this driver won, counting one clinched but not yet over.

    Settled seasons come from the canonical snapshot. The season still running
    has no final snapshot, so it counts only once the title is mathematically
    safe — the same bar the standings page marks.
    """
    rows = (
        await db.execute(
            select(
                DriverChampionshipStanding.year,
                DriverChampionshipStanding.is_final,
            ).where(
                DriverChampionshipStanding.driver_id == driver_id,
                DriverChampionshipStanding.position == 1,
            )
        )
    ).all()
    years = sorted(row.year for row in rows if row.is_final)
    for row in rows:
        if row.is_final:
            continue
        clinch = await clinched_champion(db, int(row.year), "driver")
        if clinch and clinch[1] == driver_id:
            years.append(int(row.year))
    return sorted(years)


async def driver_title_count(db, driver_id: int) -> int:
    """How many titles this driver has won; see `driver_title_years`."""
    return len(await driver_title_years(db, driver_id))
