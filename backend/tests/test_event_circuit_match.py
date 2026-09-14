"""Schedule entries resolve to one circuit layout even where a location has several."""

import pytest
from sqlalchemy import func, select

from app.models import Circuit
from app.services.event_service import EventService


async def _shared_location(db):
    row = (
        await db.execute(
            select(Circuit.location, Circuit.country)
            .group_by(Circuit.location, Circuit.country)
            .having(func.count() > 1)
            .limit(1)
        )
    ).first()
    if row is None:
        pytest.skip("no location with more than one layout")
    return row[0], row[1]


async def test_location_with_several_layouts_resolves_to_one(ingested_data):
    db = ingested_data
    location, country = await _shared_location(db)

    circuit = await EventService._find_matching_circuit(db, location, country)

    assert circuit is not None
    assert circuit.location == location


async def test_madrid_resolves_to_the_madring(ingested_data):
    db = ingested_data
    layouts = (
        (
            await db.execute(
                select(Circuit.layout_slug).where(Circuit.location == "Madrid")
            )
        )
        .scalars()
        .all()
    )
    if "madring-2026-madrid" not in layouts or len(layouts) < 2:
        pytest.skip("Madrid does not carry both Jarama and the Madring")

    circuit = await EventService._find_matching_circuit(db, "Madrid", "Spain")

    assert circuit is not None
    assert circuit.layout_slug == "madring-2026-madrid"


async def test_unknown_location_falls_back_to_country(ingested_data):
    db = ingested_data

    circuit = await EventService._find_matching_circuit(db, "Nowhere", "Italy")

    assert circuit is not None
    assert circuit.country == "Italy"


async def test_unknown_country_matches_nothing(ingested_data):
    assert (
        await EventService._find_matching_circuit(ingested_data, "Nowhere", "Nowhere")
    ) is None
