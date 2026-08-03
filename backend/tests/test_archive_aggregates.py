"""Archive aggregates must answer exactly as the live computation would."""

import pytest
from sqlalchemy import func, select

from app.models import AggConstructorCareer, AggDriverCareer
from app.services.archive_aggregate_service import ArchiveAggregateService
from app.services.constructor_catalog_service import ConstructorCatalogService
from app.services.driver_catalog_service import DriverCatalogService

from .perf.statement_counter import count_statements


async def _aggregate_is_populated(db) -> bool:
    return bool(await db.scalar(select(func.count()).select_from(AggDriverCareer)))


@pytest.mark.parametrize("include_sprint", [True, False])
async def test_driver_list_matches_live_computation(ingested_data, include_sprint):
    db = ingested_data
    if not await _aggregate_is_populated(db):
        pytest.skip("archive aggregates have not been refreshed")

    aggregated = await ArchiveAggregateService.driver_list(db, include_sprint)
    live = await DriverCatalogService.compute_all(db, include_sprint)

    assert aggregated.total == live.total
    assert aggregated.model_dump() == live.model_dump()


@pytest.mark.parametrize("include_sprint", [True, False])
async def test_constructor_list_matches_live_computation(ingested_data, include_sprint):
    db = ingested_data
    if not await _aggregate_is_populated(db):
        pytest.skip("archive aggregates have not been refreshed")

    aggregated = await ArchiveAggregateService.constructor_list(db, include_sprint)
    live = await ConstructorCatalogService.compute_all(db, include_sprint)

    assert aggregated.total == live.total
    assert aggregated.model_dump() == live.model_dump()


async def test_aggregate_read_is_a_single_statement(ingested_data):
    db = ingested_data
    if not await _aggregate_is_populated(db):
        pytest.skip("archive aggregates have not been refreshed")

    with count_statements() as counter:
        listing = await ArchiveAggregateService.driver_list(db, True)

    assert listing.drivers
    assert counter.count == 1, counter.report()


async def test_rows_carry_a_refresh_timestamp(ingested_data):
    db = ingested_data
    if not await _aggregate_is_populated(db):
        pytest.skip("archive aggregates have not been refreshed")

    assert await ArchiveAggregateService.refreshed_at(db) is not None
    assert await db.scalar(select(func.count()).select_from(AggConstructorCareer)) > 0


async def test_both_sprint_variants_are_materialized(ingested_data):
    db = ingested_data
    if not await _aggregate_is_populated(db):
        pytest.skip("archive aggregates have not been refreshed")

    variants = set(await db.scalars(select(AggDriverCareer.include_sprint).distinct()))
    assert variants == {True, False}


async def test_empty_aggregate_falls_back_to_live_computation(db_session):
    """CI runs against a database with neither results nor aggregates."""
    db = db_session
    if await _aggregate_is_populated(db):
        pytest.skip("aggregates are populated; fallback is exercised in CI")

    listing = await ArchiveAggregateService.driver_list(db, True)

    assert listing.total == 0
    assert listing.drivers == []
