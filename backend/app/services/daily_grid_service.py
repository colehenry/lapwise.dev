"""Daily grid discovery, driver search, and snapshot-based validation."""

from datetime import date, datetime, timezone

from sqlalchemy import case, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AggDriverCareer, Driver, Puzzle, Session, SessionResult
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


def _today() -> date:
    """Boards publish at 00:00 UTC, so the calendar is UTC's."""
    return datetime.now(timezone.utc).date()


def _published():
    """A board is playable once approved and its publication date has arrived.

    A future-dated published row is scheduled, not live, so the editorial queue
    can run ahead of the calendar without exposing tomorrow's board.
    """
    return (Puzzle.status == "published") & (Puzzle.published_on <= _today())


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
    async def puzzle(db: AsyncSession, number: int | None = None) -> DailyGameResponse:
        """One published board, or the latest when no number is given.

        Answers, option lists and evidence are never selected here: the board
        payload is read on every page load and the evidence column alone runs
        to hundreds of records.
        """
        statement = select(
            Puzzle.public_id,
            Puzzle.number,
            Puzzle.published_on,
            Puzzle.answer_version,
            Puzzle.max_guesses,
            Puzzle.row_categories,
            Puzzle.column_categories,
            Puzzle.rookie_options.is_not(None).label("has_rookie_mode"),
        ).where(_published())
        if number is None:
            statement = statement.order_by(
                Puzzle.published_on.desc(), Puzzle.number.desc()
            ).limit(1)
        else:
            statement = statement.where(Puzzle.number == number)

        row = (await db.execute(statement)).one_or_none()
        if row is None:
            raise ValueError("Grid not found")

        # Neighbours come from the same published set, so an unpublished gap in
        # the numbering cannot produce a link to a board that will not load.
        neighbours = (
            await db.execute(
                select(
                    func.max(Puzzle.number).filter(Puzzle.number < row.number),
                    func.min(Puzzle.number).filter(Puzzle.number > row.number),
                ).where(_published())
            )
        ).one()

        return DailyGameResponse(
            id=row.public_id,
            number=row.number,
            published_on=row.published_on,
            answer_version=row.answer_version,
            max_guesses=row.max_guesses,
            previous_number=neighbours[0],
            next_number=neighbours[1],
            has_rookie_mode=bool(row.has_rookie_mode),
            rows=[_public_category(category) for category in row.row_categories],
            columns=[_public_category(category) for category in row.column_categories],
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
        board = (
            await db.execute(
                select(Puzzle.public_id, Puzzle.rookie_options).where(
                    _published(), Puzzle.number == number
                )
            )
        ).one_or_none()
        if board is None:
            raise ValueError("Grid not found")
        options = board.rookie_options
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
            puzzle_id=board.public_id,
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
        cell_id = f"{row_id}__{column_id}"
        normalized_slug = driver_slug.strip().lower()

        # The answer set and the evidence pair are resolved in Postgres rather
        # than loaded into Python: a board's evidence runs to hundreds of
        # records and a guess needs exactly two of them.
        verdict = (
            await db.execute(
                text(
                    "SELECT jsonb_exists(answers, :cell_id) AS cell_exists,"
                    " COALESCE("
                    "   answers -> :cell_id @> to_jsonb(CAST(:slug AS text)), false"
                    " ) AS correct,"
                    " rookie_evidence -> :row_key AS row_evidence,"
                    " rookie_evidence -> :column_key AS column_evidence"
                    " FROM puzzles"
                    " WHERE public_id = :public_id"
                    "   AND status = 'published'"
                    "   AND published_on <= :today"
                ),
                {
                    "cell_id": cell_id,
                    "slug": normalized_slug,
                    "row_key": f"{normalized_slug}__{row_id}",
                    "column_key": f"{normalized_slug}__{column_id}",
                    "public_id": puzzle_id,
                    "today": _today(),
                },
            )
        ).one_or_none()
        if verdict is None:
            raise ValueError("Grid not found")
        if not verdict.cell_exists:
            raise ValueError("That row and column do not belong to this puzzle")

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

        return GameGuessResponse(
            correct=bool(verdict.correct),
            row_id=row_id,
            column_id=column_id,
            driver=_driver_response(
                row.Driver,
                row.headshot_url,
                (await _resolve_media(db, [row.Driver.id])).get(row.Driver.id),
            ),
            row_evidence=verdict.row_evidence,
            column_evidence=verdict.column_evidence,
        )
