"""Query-count budgets for the hot public read paths.

Budgets are upper bounds, not exact counts: they fail when a service starts
issuing per-entity queries again. Lower a budget in the PR that earns it.
"""

from app.services.canonical_standings_service import CanonicalStandingsService
from app.services.circuit_service import CircuitService
from app.services.constructor_service import ConstructorService
from app.services.driver_service import DriverService

from .statement_counter import count_statements

# Measured on the production database at 10b4b6d; see
# scripts/perf/README.md.
STANDINGS_BUDGET = 31
CONSTRUCTOR_PROFILE_BUDGET = 8
CONSTRUCTOR_HISTORY_BUDGET = 11
CONSTRUCTOR_LIST_BUDGET = 204
DRIVER_LIST_BUDGET = 1
DRIVER_PROFILE_BUDGET = 6
DRIVER_HISTORY_BUDGET = 7
CIRCUIT_LIST_BUDGET = 1


async def test_season_standings_query_budget(db, latest_season):
    with count_statements() as counter:
        response = await CanonicalStandingsService.get_season_standings(
            db, latest_season
        )

    assert response is not None
    assert counter.count <= STANDINGS_BUDGET, counter.report()


async def test_constructor_profile_query_budget(db, long_history_team):
    with count_statements() as counter:
        profile = await ConstructorService.get_constructor_profile(
            db, long_history_team
        )

    assert profile is not None
    assert counter.count <= CONSTRUCTOR_PROFILE_BUDGET, counter.report()


async def test_constructor_season_history_query_budget(db, long_history_team):
    with count_statements() as counter:
        history = await ConstructorService.get_season_history(db, long_history_team)

    assert history is not None
    assert counter.count <= CONSTRUCTOR_HISTORY_BUDGET, counter.report()


async def test_constructor_season_history_count_is_independent_of_history_length(
    db, long_history_team, short_history_team
):
    with count_statements() as long_counter:
        long_history = await ConstructorService.get_season_history(
            db, long_history_team
        )
    with count_statements() as short_counter:
        short_history = await ConstructorService.get_season_history(
            db, short_history_team
        )

    assert long_history is not None
    assert short_history is not None
    assert len(long_history.seasons) > len(short_history.seasons)
    assert long_counter.count == short_counter.count, (
        f"season history query count grows with season count:\n"
        f"{long_history_team} ({len(long_history.seasons)} seasons)\n"
        f"{long_counter.report()}\n"
        f"{short_history_team} ({len(short_history.seasons)} seasons)\n"
        f"{short_counter.report()}"
    )


async def test_constructor_list_query_budget(db):
    with count_statements() as counter:
        listing = await ConstructorService.get_all_constructors(db)

    assert listing.constructors
    assert counter.count <= CONSTRUCTOR_LIST_BUDGET, counter.report()


async def test_driver_list_query_budget(db):
    with count_statements() as counter:
        listing = await DriverService.get_all_drivers(db)

    assert listing.drivers
    assert counter.count <= DRIVER_LIST_BUDGET, counter.report()


async def test_circuit_list_query_budget(db):
    with count_statements() as counter:
        listing = await CircuitService.get_all_circuits(db)

    assert listing.circuits
    assert counter.count <= CIRCUIT_LIST_BUDGET, counter.report()


async def test_driver_profile_query_budget(db, profiled_driver_code):
    with count_statements() as counter:
        profile = await DriverService.get_driver_profile(db, profiled_driver_code)

    assert profile is not None
    assert counter.count <= DRIVER_PROFILE_BUDGET, counter.report()


async def test_driver_season_history_query_budget(db, profiled_driver_code):
    with count_statements() as counter:
        history = await DriverService.get_season_history(db, profiled_driver_code)

    assert history is not None
    assert counter.count <= DRIVER_HISTORY_BUDGET, counter.report()
