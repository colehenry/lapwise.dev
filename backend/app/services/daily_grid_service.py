"""Daily grid discovery, driver search, and snapshot-based validation."""

import json
from functools import lru_cache
from pathlib import Path

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AggDriverCareer, Driver, Session, SessionResult
from app.schemas.daily_grid import (
    DailyGameResponse,
    GameCategory,
    GameDriver,
    GameDriverCatalogItem,
    GameDriverCatalogResponse,
    GameDriverSearchResponse,
    GameGuessResponse,
    RookieOptionsResponse,
)
from app.schemas.media import DriverMedia
from app.services.driver_catalog_service import DriverCatalogService
from app.services.media_service import MediaService

_PUZZLE_DIRECTORY = Path(__file__).resolve().parents[2] / "data" / "game_puzzles"
_PUZZLE_NUMBERS = tuple(range(1, 6))


@lru_cache(maxsize=32)
def _load_puzzle(path: Path, modified_ns: int) -> dict:
    del modified_ns
    with path.open(encoding="utf-8") as puzzle_file:
        return json.load(puzzle_file)


def _puzzle(number: int) -> dict:
    if number not in _PUZZLE_NUMBERS:
        raise ValueError("Grid not found")
    path = _PUZZLE_DIRECTORY / f"grid-{number:03d}.json"
    return _load_puzzle(path, path.stat().st_mtime_ns)


def _puzzle_number(puzzle_id: str) -> int:
    try:
        prefix, raw_number = puzzle_id.rsplit("-", 1)
        number = int(raw_number)
    except (TypeError, ValueError) as error:
        raise ValueError("Grid not found") from error
    if prefix != "grid" or number not in _PUZZLE_NUMBERS:
        raise ValueError("Grid not found")
    return number


def _public_category(raw: dict) -> GameCategory:
    return GameCategory(
        id=raw["id"],
        label=raw["label"],
        prompt_label=raw["prompt_label"],
        description=raw["description"],
        visual=raw["visual"],
    )


def _driver_response(
    driver: Driver,
    headshot_url: str | None,
    media: DriverMedia | None = None,
) -> GameDriver:
    return GameDriver(
        driver_slug=driver.slug,
        full_name=driver.full_name,
        driver_code=driver.driver_code,
        # Resolved media wins; the legacy column is the fallback until step 10.
        headshot_url=media.url if media else headshot_url,
        media=media,
    )


async def _resolve_media(
    db: AsyncSession, driver_ids: list[int]
) -> dict[int, DriverMedia]:
    """Owned imagery for a set of drivers, in a fixed number of queries."""
    resolved = await MediaService.resolve_many(db, driver_ids, None, "headshot")
    return {
        driver_id: media
        for driver_id, ref in resolved.items()
        if (media := DriverMedia.from_ref(ref)) is not None
    }


def _escaped_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class DailyGridService:
    """Serve one immutable puzzle snapshot without exposing its answer sets."""

    @staticmethod
    def puzzle(number: int | None = None) -> DailyGameResponse:
        resolved_number = number or _PUZZLE_NUMBERS[-1]
        puzzle = _puzzle(resolved_number)
        current_index = _PUZZLE_NUMBERS.index(resolved_number)
        return DailyGameResponse(
            id=puzzle["id"],
            number=puzzle["number"],
            published_on=puzzle["published_on"],
            answer_version=puzzle["answer_version"],
            max_guesses=puzzle["max_guesses"],
            previous_number=(
                _PUZZLE_NUMBERS[current_index - 1] if current_index > 0 else None
            ),
            next_number=(
                _PUZZLE_NUMBERS[current_index + 1]
                if current_index < len(_PUZZLE_NUMBERS) - 1
                else None
            ),
            has_rookie_mode=bool(puzzle.get("rookie_options")),
            rows=[_public_category(category) for category in puzzle["rows"]],
            columns=[_public_category(category) for category in puzzle["columns"]],
        )

    @staticmethod
    def _latest_headshot():
        return (
            select(SessionResult.headshot_url)
            .join(Session, Session.id == SessionResult.session_id)
            .where(
                SessionResult.driver_id == Driver.id,
                Session.session_type == "race",
                SessionResult.headshot_url.is_not(None),
                SessionResult.headshot_url != "",
            )
            .order_by(Session.date.desc())
            .limit(1)
            .correlate(Driver)
            .scalar_subquery()
        )

    @staticmethod
    async def driver_catalog(db: AsyncSession) -> GameDriverCatalogResponse:
        rows = (
            await db.execute(
                select(AggDriverCareer)
                .where(
                    AggDriverCareer.include_sprint.is_(False),
                    AggDriverCareer.driver_slug.is_not(None),
                )
                .order_by(AggDriverCareer.full_name)
            )
        ).scalars()
        rows = list(rows)
        # The dropdown and the grid cell both read this catalog, so resolving
        # here is what keeps the two showing the same photograph.
        media = await _resolve_media(db, [row.driver_id for row in rows])
        drivers = [
            GameDriverCatalogItem(
                driver_slug=row.driver_slug,
                full_name=row.full_name,
                driver_code=row.driver_code,
                headshot_url=(
                    media[row.driver_id].url
                    if row.driver_id in media
                    else row.headshot_url
                ),
                media=media.get(row.driver_id),
                race_entries=row.total_races,
            )
            for row in rows
        ]
        if drivers:
            return GameDriverCatalogResponse(drivers=drivers)

        live_rows = await DriverCatalogService.compute_rows(db, include_sprint=False)
        return GameDriverCatalogResponse(
            drivers=[
                GameDriverCatalogItem(
                    driver_slug=row["driver_slug"],
                    full_name=row["full_name"],
                    driver_code=row["driver_code"],
                    headshot_url=row["headshot_url"],
                    race_entries=row["total_races"],
                )
                for row in live_rows
                if row["driver_slug"]
            ]
        )

    @staticmethod
    async def rookie_options(db: AsyncSession, number: int) -> RookieOptionsResponse:
        """The frozen per-cell option lists, hydrated with names and imagery.

        The frozen order is preserved: it was shuffled at freeze time, and
        re-sorting here would leak structure across cells.
        """
        puzzle = _puzzle(number)
        options = puzzle.get("rookie_options")
        if not options:
            raise ValueError("This grid has no rookie options")

        slugs = {slug for cell in options.values() for slug in cell}
        latest_headshot = DailyGridService._latest_headshot()
        rows = (
            await db.execute(
                select(Driver, latest_headshot.label("headshot_url")).where(
                    Driver.slug.in_(slugs)
                )
            )
        ).all()
        media = await _resolve_media(db, [row.Driver.id for row in rows])
        by_slug = {
            row.Driver.slug: _driver_response(
                row.Driver, row.headshot_url, media.get(row.Driver.id)
            )
            for row in rows
        }
        return RookieOptionsResponse(
            puzzle_id=puzzle["id"],
            options={
                cell_id: [by_slug[slug] for slug in cell_slugs if slug in by_slug]
                for cell_id, cell_slugs in options.items()
            },
        )

    @staticmethod
    async def search_drivers(
        db: AsyncSession, query: str, limit: int = 12
    ) -> GameDriverSearchResponse:
        normalized = query.strip()
        if len(normalized) < 2:
            return GameDriverSearchResponse(drivers=[])

        lowered = normalized.lower()
        pattern = f"%{_escaped_like(normalized)}%"
        race_entry_counts = (
            select(
                SessionResult.driver_id.label("driver_id"),
                func.count(SessionResult.id).label("race_entries"),
            )
            .join(Session, Session.id == SessionResult.session_id)
            .where(Session.session_type == "race")
            .group_by(SessionResult.driver_id)
            .subquery()
        )
        latest_headshot = DailyGridService._latest_headshot()
        statement = (
            select(Driver, latest_headshot.label("headshot_url"))
            .join(race_entry_counts, race_entry_counts.c.driver_id == Driver.id)
            .where(
                or_(
                    Driver.full_name.ilike(pattern, escape="\\"),
                    Driver.slug.ilike(pattern, escape="\\"),
                    Driver.driver_code.ilike(pattern, escape="\\"),
                ),
            )
            .order_by(
                case(
                    (func.lower(Driver.full_name) == lowered, 0),
                    (func.lower(Driver.slug) == lowered, 1),
                    (func.lower(Driver.driver_code) == lowered, 2),
                    else_=3,
                ),
                race_entry_counts.c.race_entries.desc(),
                Driver.full_name,
            )
            .limit(limit)
        )
        drivers = (await db.execute(statement)).all()
        media = await _resolve_media(db, [row.Driver.id for row in drivers])
        return GameDriverSearchResponse(
            drivers=[
                _driver_response(row.Driver, row.headshot_url, media.get(row.Driver.id))
                for row in drivers
            ]
        )

    @staticmethod
    async def submit_guess(
        db: AsyncSession,
        puzzle_id: str,
        row_id: str,
        column_id: str,
        driver_slug: str,
    ) -> GameGuessResponse | None:
        puzzle = _puzzle(_puzzle_number(puzzle_id))
        if puzzle["id"] != puzzle_id:
            raise ValueError("Grid not found")
        cell_id = f"{row_id}__{column_id}"
        if cell_id not in puzzle["answers"]:
            raise ValueError("That row and column do not belong to this puzzle")

        normalized_slug = driver_slug.strip().lower()
        latest_headshot = DailyGridService._latest_headshot()
        row = (
            await db.execute(
                select(Driver, latest_headshot.label("headshot_url")).where(
                    Driver.slug == normalized_slug
                )
            )
        ).one_or_none()
        if row is None:
            return None

        evidence = puzzle.get("rookie_evidence", {})
        return GameGuessResponse(
            correct=normalized_slug in puzzle["answers"][cell_id],
            row_id=row_id,
            column_id=column_id,
            driver=_driver_response(
                row.Driver,
                row.headshot_url,
                (await _resolve_media(db, [row.Driver.id])).get(row.Driver.id),
            ),
            row_evidence=evidence.get(f"{normalized_slug}__{row_id}"),
            column_evidence=evidence.get(f"{normalized_slug}__{column_id}"),
        )
