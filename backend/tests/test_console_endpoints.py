"""Coverage for the homepage console's four endpoints.

Every assertion that matters is made against 2026 round 13 — Monza, which was
red-flagged, carries 62 null lap times across 1,054 rows, and lost three cars.
A clean round proves none of the things that actually broke while this was
being built.
"""

import gzip
import json

import pytest
from sqlalchemy import select

from app.models import Session as RaceSession
from app.services.archive_aggregate_service import ArchiveAggregateService
from app.services.console_replay_service import ConsoleReplayService
from app.services.daily_grid_service import DailyGridService

SEASON = 2026
RED_FLAGGED_ROUND = 13
GZIP_BUDGET_BYTES = 80 * 1024


@pytest.fixture
async def monza(ingested_data):
    """The red-flagged round, skipped when this database has not ingested it."""
    session = await ingested_data.scalar(
        select(RaceSession.id)
        .where(RaceSession.year == SEASON)
        .where(RaceSession.round == RED_FLAGGED_ROUND)
        .where(RaceSession.session_type == "race")
    )
    if session is None:
        pytest.skip(f"{SEASON} round {RED_FLAGGED_ROUND} is not in this database")
    return await ConsoleReplayService.get_console_replay(
        ingested_data, SEASON, RED_FLAGGED_ROUND
    )


async def test_the_clock_comes_from_lap_starts_not_from_summed_lap_times(monza):
    """Null lap times must not truncate a car's trace.

    Summing `lap_time_seconds` and stopping at the first null cut every car at
    Monza down to three laps. The clock is `lap_start_time_seconds`, which is
    complete.
    """
    assert monza.total_laps == 53
    winner = next(car for car in monza.cars if car.final_position == 1)
    assert len(winner.laps) == monza.total_laps
    assert len(winner.start) == len(winner.laps)

    assert any(lap.t is None for car in monza.cars for lap in car.laps)
    for car in monza.cars:
        assert car.start == sorted(car.start)
        assert car.end >= car.start[-1]


async def test_the_stoppage_is_emitted_as_a_skip(monza):
    """Without this the homepage sits still for thirty-two minutes."""
    assert len(monza.skips) == 1
    start, end = monza.skips[0]
    assert end - start > 1800
    assert monza.t0 < start < end < monza.t_end


async def test_flag_periods_are_status_windows_and_never_feed_lines(monza):
    """The timeline draws every flag, so a feed line would repeat it."""
    assert any(window.code == "red" for window in monza.status)
    assert all(window.to_seconds > window.from_seconds for window in monza.status)
    kinds = {event.kind for event in monza.feed}
    assert {"pit", "out", "lead", "fast"} <= kinds
    assert kinds.isdisjoint({"red", "yellow", "sc", "vsc"})


async def test_the_feed_is_ordered_and_labelled_by_the_leaders_laps(monza):
    times = [event.t for event in monza.feed]
    assert times == sorted(times)
    for event in monza.feed:
        assert 1 <= event.lap <= monza.total_laps
        assert event.text


async def test_cars_below_four_laps_are_dropped(monza):
    assert all(len(car.laps) >= 4 for car in monza.cars)
    assert len(monza.cars) < 22, "Monza lost a car before it completed four laps"


async def test_only_the_ingested_speed_traps_are_emitted(monza):
    """Throttle, brake, gear and ERS are not ingested and must not be invented."""
    lap = monza.cars[0].laps[0]
    assert len(lap.v) == 4
    assert len(lap.s) == 3
    assert set(lap.model_dump()) == {"t", "c", "age", "s", "v", "pos", "pit", "pb"}


async def test_the_payload_fits_the_gzip_budget(monza):
    encoded = gzip.compress(monza.model_dump_json(by_alias=True).encode())
    assert len(encoded) <= GZIP_BUDGET_BYTES, f"{len(encoded)} bytes gzipped"


async def test_a_missing_round_returns_nothing_rather_than_a_partial_payload(
    ingested_data,
):
    assert (
        await ConsoleReplayService.get_console_replay(ingested_data, SEASON, 99) is None
    )


async def test_the_daily_summary_conceals_the_board(published_boards):
    summary = await DailyGridService.summary(published_boards)
    body = json.loads(summary.model_dump_json())

    assert summary.rows > 0 and summary.columns > 0
    assert summary.number > 0
    assert not any(
        key in body for key in ("rows_categories", "columns_categories", "answers")
    )
    assert all(isinstance(value, int) for value in (body["rows"], body["columns"]))


async def test_every_session_backed_field_is_null_until_sessions_are_written(
    published_boards,
):
    """`game_sessions` is migrated but nothing writes to it. No invented counts."""
    summary = await DailyGridService.summary(published_boards)
    assert summary.play_count is None
    assert summary.perfect_rate is None
    assert summary.has_played is None
    assert summary.streak is None
    assert summary.last_seven is None


async def test_archive_counts_agree_with_the_listings_they_stand_in_for(
    ingested_data,
):
    counts = await ArchiveAggregateService.counts(ingested_data)
    drivers = await ArchiveAggregateService.driver_list(ingested_data)
    constructors = await ArchiveAggregateService.constructor_list(ingested_data)

    assert counts.drivers == len(drivers.drivers)
    assert counts.constructors == len(constructors.constructors)
    assert counts.races > counts.circuits > 0
    assert counts.first_season and counts.first_season >= 1950
