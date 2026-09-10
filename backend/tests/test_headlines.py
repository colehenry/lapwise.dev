"""Coverage for the ticker's candidate pool.

This is the one place on the homepage where a bug produces a confident
falsehood, so the thresholds, the truth rules and the copy conventions are all
pinned here. The derivations are pure functions over a context, so most of this
runs on built histories rather than the database.
"""

import pytest
from sqlalchemy import select

from app.models import Session as RaceSession
from app.services.headlines.championship import championship
from app.services.headlines.common import (
    MIN_RUN_ENDED,
    MIN_STREAK,
    apostrophe,
    trailing_run,
)
from app.services.headlines.context import (
    HeadlineContext,
    HeadlineContextLoader,
    RaceEntry,
)
from app.services.headlines.qualifying import qualifying
from app.services.headlines.race import last_race
from app.services.headlines.service import HeadlinesService
from app.services.headlines.streaks import firsts, runs_ended, streaks

SEASON = 2026


def entry(
    round_number: int,
    *,
    driver_id: int = 1,
    code: str = "AAA",
    name: str = "Ada Aalto",
    team: str = "Team A",
    position: int | None = 5,
    grid: int | None = 5,
    points: float = 4.0,
    status: str = "Finished",
    year: int = SEASON,
) -> RaceEntry:
    """One race result, with everything the derivations read."""
    from datetime import date

    return RaceEntry(
        year=year,
        round=round_number,
        date=date(year, 1, 1),
        driver_id=driver_id,
        driver_code=code,
        full_name=name,
        team_name=team,
        position=position,
        grid_position=grid,
        points=points,
        status=status,
        fastest_lap=False,
        time_seconds=None,
        circuit_name="Test Circuit",
    )


def context_for(races: list[RaceEntry], latest: int | None = None) -> HeadlineContext:
    latest_round = latest if latest is not None else max(e.round for e in races)
    season_races = [e for e in races if e.year == SEASON]
    return HeadlineContext(
        season=SEASON,
        latest_round=latest_round,
        standings=None,
        season_races=season_races,
        career_races=races,
    )


def texts(headlines) -> list[str]:
    return [headline.text for headline in headlines]


def test_streak_at_the_threshold_appears_and_one_below_does_not():
    at_threshold = [entry(r, position=1, points=25.0) for r in range(1, MIN_STREAK + 1)]
    assert any(
        "has won the last" in text for text in texts(streaks(context_for(at_threshold)))
    )

    below = [entry(r, position=1, points=25.0) for r in range(1, MIN_STREAK)]
    assert not any(
        "has won the last" in text for text in texts(streaks(context_for(below)))
    )


def test_a_drought_resets_on_the_race_that_ends_it():
    history = [entry(r, position=8, points=4.0) for r in range(1, 8)]
    history[0] = entry(1, position=1, points=25.0)
    history.append(entry(8, position=1, points=25.0))

    found = texts(firsts(context_for(history)))
    assert any("first win in 6 races" in text for text in found)

    # The very next win is no longer a drought ending.
    history.append(entry(9, position=1, points=25.0))
    assert not any(
        "first win in" in text for text in texts(firsts(context_for(history)))
    )


def test_a_career_first_outranks_a_season_scoped_stat():
    debut = [entry(r, position=8, points=4.0) for r in range(1, 5)]
    debut.append(entry(5, position=2, points=18.0))
    first_podium = next(
        h for h in firsts(context_for(debut)) if "first career" in h.text
    )

    seasonal = [entry(r, position=1, points=25.0) for r in range(1, 6)]
    win_streak = next(h for h in streaks(context_for(seasonal)) if "has won" in h.text)

    assert first_podium.weight > win_streak.weight


def test_a_run_of_eleven_is_not_news_and_a_run_of_twelve_is():
    def history(length: int) -> list[RaceEntry]:
        # The leading blank round is what makes the run measurable: it is the
        # earlier occurrence the claim counts back to.
        opener = [entry(1, position=15, points=0.0)]
        scoring = [entry(r + 1, position=5, points=10.0) for r in range(1, length + 1)]
        return opener + scoring + [entry(length + 2, position=15, points=0.0)]

    assert not runs_ended(context_for(history(MIN_RUN_ENDED - 1)))
    assert runs_ended(context_for(history(MIN_RUN_ENDED)))


def test_a_run_that_ended_before_the_last_round_is_dropped():
    scoring = [entry(r, position=5, points=10.0) for r in range(1, MIN_RUN_ENDED + 1)]
    broken = scoring + [entry(MIN_RUN_ENDED + 1, position=15, points=0.0)]
    recovered = broken + [
        entry(MIN_RUN_ENDED + 2, position=5, points=10.0),
        entry(MIN_RUN_ENDED + 3, position=5, points=10.0),
    ]
    assert not runs_ended(context_for(recovered))


def test_a_run_that_reaches_the_start_of_the_data_makes_no_claim():
    """The number would say how much history was loaded, not how rare it is."""
    assert trailing_run([], lambda _: True) is None
    unbroken = [entry(r, position=5, points=10.0) for r in range(1, 20)]
    assert trailing_run(unbroken, lambda e: e.points > 0) is None
    assert trailing_run(unbroken + [entry(20, points=0.0)], lambda e: e.points > 0) == 0


def test_a_tie_renders_both_names():
    shared = [
        entry(r, driver_id=1, code="AAA", name="Ada Aalto", points=10.0, position=5)
        for r in range(1, 9)
    ] + [
        entry(
            r,
            driver_id=2,
            code="BBB",
            name="Bo Berg",
            team="Team B",
            points=10.0,
            position=6,
        )
        for r in range(1, 9)
    ]
    longest = next(
        h for h in streaks(context_for(shared)) if "Longest current points" in h.text
    )
    assert "Aalto" in longest.text and "Berg" in longest.text
    assert {token.code for token in longest.tokens} == {"AAA", "BBB"}


def test_an_empty_pool_is_empty_rather_than_a_crash():
    empty = HeadlineContext(season=SEASON, latest_round=None, standings=None)
    for derive in (championship, last_race, streaks, firsts, runs_ended, qualifying):
        assert derive(empty) == []


def test_tokens_address_the_span_they_name():
    wins = [entry(r, position=1, points=25.0) for r in range(1, 5)]
    for headline in streaks(context_for(wins)):
        for token in headline.tokens:
            assert headline.text[token.start : token.end]


def test_apostrophe_follows_the_catalogue_convention():
    assert apostrophe("Mercedes") == "'"
    assert apostrophe("Williams") == "'"
    assert apostrophe("Hamilton") == "'s"


@pytest.mark.asyncio
async def test_sprint_results_never_reach_the_pool(ingested_data):
    """A sprint win must not count toward a win total or extend a streak."""
    db = ingested_data
    season = await db.scalar(
        select(RaceSession.year)
        .where(RaceSession.session_type == "race")
        .order_by(RaceSession.date.desc())
        .limit(1)
    )
    context = await HeadlineContextLoader.load(db, season)
    sprint_rounds = set(
        (
            await db.scalars(
                select(RaceSession.round)
                .where(RaceSession.year == season)
                .where(RaceSession.session_type.in_(["sprint_race", "sprint"]))
            )
        ).all()
    )
    if not sprint_rounds:
        pytest.skip("no sprint rounds in the latest season")

    winners = [e for e in context.season_races if e.position == 1]
    per_round = {}
    for winner in winners:
        assert winner.round not in per_round, "a round yielded two winners"
        per_round[winner.round] = winner
    assert len(winners) == len({e.round for e in context.season_races})


@pytest.mark.asyncio
async def test_a_red_flagged_null_heavy_round_still_yields_headlines(ingested_data):
    """Monza 2026: 62 null lap times, a red flag, three retirements."""
    context = await HeadlineContextLoader.load(ingested_data, 2026)
    if context.latest_round != 13:
        pytest.skip("2026 round 13 is not the latest round in this database")

    found = texts(last_race(context))
    assert any("red-flagged" in text for text in found)
    assert not any("restarted" in text for text in found), (
        "the status table proves the flag, not that the race resumed"
    )
    assert any("failed to finish" in text for text in found)
    assert any("wins by" in text for text in found)


@pytest.mark.asyncio
async def test_the_pool_is_deterministic_and_within_its_budget(ingested_data):
    first = await HeadlinesService.get_headlines(ingested_data, 2026)
    second = await HeadlinesService.get_headlines(ingested_data, 2026)

    assert [h.id for h in first.headlines] == [h.id for h in second.headlines]
    assert len(first.headlines) <= 40
    assert len({h.id for h in first.headlines}) == len(first.headlines)
    for headline in first.headlines:
        assert len(headline.kicker) <= 22
        assert headline.text
        for token in headline.tokens:
            assert headline.text[token.start : token.end]


@pytest.mark.asyncio
async def test_qualifying_claims_only_use_rounds_the_data_can_segment(ingested_data):
    """Outside 2026 the Q1/Q2/Q3 columns are filled for eliminated drivers.

    A career-scoped "first time in N races" read off them would be a confident
    falsehood, so unreadable rounds never enter the context.
    """
    readable = await HeadlineContextLoader._readable_qualifying_rounds(ingested_data)
    for year, _ in readable:
        assert year >= 2026, "an older round claimed readable Q1/Q2/Q3 segmentation"


@pytest.mark.asyncio
@pytest.mark.parametrize("season", [1950, 1975, 2005, 2025, 2026])
async def test_every_era_derives_without_a_nan_reaching_the_copy(ingested_data, season):
    """Early seasons carry NaN in `time_seconds`; it must not reach a headline."""
    response = await HeadlinesService.get_headlines(ingested_data, season)
    for headline in response.headlines:
        assert "nan" not in headline.text.lower()
        assert "inf" not in headline.text.lower().split()


@pytest.mark.asyncio
async def test_the_season_is_never_given_a_length(ingested_data):
    """The schedule feed caps at ten, so a total round count is unknowable."""
    response = await HeadlinesService.get_headlines(ingested_data, 2026)
    for headline in response.headlines:
        assert "rounds in total" not in headline.text
        assert "round season" not in headline.text
