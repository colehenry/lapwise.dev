"""The resolved header catalog, held in memory per eligibility floor.

Building it resolves every predicate against the whole pool, which is seconds
of work and a pure function of ingested results. Once built, a board preview
is nine set intersections, so the builder can answer every header change
without touching the database.
"""

from dataclasses import dataclass

from fastapi.concurrency import run_in_threadpool

from scripts.game_catalog import Header
from scripts.game_evidence import DriverFacts
from scripts.game_validator import Recognition

_CACHE: dict[int, "CatalogBundle"] = {}


@dataclass(frozen=True)
class CatalogBundle:
    floor: int
    pool: dict[str, DriverFacts]
    # Header id → (header, answer set).
    catalog: dict[str, tuple[Header, set[str]]]
    recognition: dict[str, Recognition]

    def header(self, header_id: str) -> Header:
        try:
            return self.catalog[header_id][0]
        except KeyError as missing:
            raise ValueError(f"Unknown header {header_id}") from missing

    def answers(self, header_id: str) -> set[str]:
        return self.catalog[self.header(header_id).id][1]


def _build(floor: int) -> CatalogBundle:
    from scripts.game_catalog import build_catalog
    from scripts.game_predicates import load_pool
    from scripts.game_validator import load_recognition
    from scripts.ingest.utils import get_db_session

    session = get_db_session()
    try:
        pool = load_pool(session, floor)
        # Every header with at least one answer. The generator applies its own
        # depth floor; a hand-built board is judged on the live cell counts.
        catalog = build_catalog(session, pool, minimum_depth=1)
        recognition = load_recognition(session, pool)
    finally:
        session.close()
    return CatalogBundle(
        floor=floor, pool=pool, catalog=catalog, recognition=recognition
    )


async def catalog_bundle(floor: int) -> CatalogBundle:
    bundle = _CACHE.get(floor)
    if bundle is None:
        bundle = await run_in_threadpool(_build, floor)
        _CACHE[floor] = bundle
    return bundle
