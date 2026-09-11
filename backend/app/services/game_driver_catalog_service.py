"""Shared searchable driver catalog for both daily games."""

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AggDriverCareer, Driver, Session, SessionResult
from app.schemas.daily_grid import (
    GameDriverCatalogItem,
    GameDriverCatalogResponse,
    GameDriverSearchResponse,
)
from app.schemas.media import DriverMedia
from app.services.driver_catalog_service import DriverCatalogService
from app.services.media_service import MediaService


def _escaped_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class GameDriverCatalogService:
    """One media-aware driver catalog instead of a copy per game."""

    @staticmethod
    async def _media(db: AsyncSession, ids: list[int]) -> dict[int, DriverMedia]:
        resolved = await MediaService.resolve_many(db, ids, None, "headshot")
        return {
            driver_id: media
            for driver_id, ref in resolved.items()
            if (media := DriverMedia.from_ref(ref)) is not None
        }

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
    async def catalog(
        db: AsyncSession, driver_ids: set[int] | None = None
    ) -> GameDriverCatalogResponse:
        statement = select(AggDriverCareer).where(
            AggDriverCareer.include_sprint.is_(False),
            AggDriverCareer.driver_slug.is_not(None),
        )
        if driver_ids is not None:
            statement = statement.where(AggDriverCareer.driver_id.in_(driver_ids))
        rows = list(
            (await db.scalars(statement.order_by(AggDriverCareer.full_name))).all()
        )
        media = await GameDriverCatalogService._media(
            db, [row.driver_id for row in rows]
        )
        drivers: list[GameDriverCatalogItem] = [
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
        found = {row.driver_id for row in rows}
        missing = (driver_ids or set()) - found
        if not missing and (drivers or driver_ids == set()):
            return GameDriverCatalogResponse(drivers=drivers)

        live_rows = await DriverCatalogService.compute_rows(db, include_sprint=False)
        requested = missing if driver_ids is not None else None
        drivers.extend(
            [
                GameDriverCatalogItem(
                    driver_slug=row["driver_slug"],
                    full_name=row["full_name"],
                    driver_code=row["driver_code"],
                    headshot_url=row["headshot_url"],
                    race_entries=row["total_races"],
                )
                for row in live_rows
                if row["driver_slug"]
                and (requested is None or row["driver_id"] in requested)
            ]
        )
        return GameDriverCatalogResponse(
            drivers=sorted(drivers, key=lambda row: row.full_name)
        )

    @staticmethod
    async def search(
        db: AsyncSession, query: str, limit: int = 12
    ) -> GameDriverSearchResponse:
        normalized = query.strip()
        if len(normalized) < 2:
            return GameDriverSearchResponse(drivers=[])
        lowered = normalized.lower()
        pattern = f"%{_escaped_like(normalized)}%"
        counts = (
            select(
                SessionResult.driver_id.label("driver_id"),
                func.count(SessionResult.id).label("race_entries"),
            )
            .join(Session, Session.id == SessionResult.session_id)
            .where(Session.session_type == "race")
            .group_by(SessionResult.driver_id)
            .subquery()
        )
        latest = GameDriverCatalogService._latest_headshot()
        rows = (
            await db.execute(
                select(Driver, latest.label("headshot_url"))
                .join(counts, counts.c.driver_id == Driver.id)
                .where(
                    or_(
                        Driver.full_name.ilike(pattern, escape="\\"),
                        Driver.slug.ilike(pattern, escape="\\"),
                        Driver.driver_code.ilike(pattern, escape="\\"),
                    )
                )
                .order_by(
                    case(
                        (func.lower(Driver.full_name) == lowered, 0),
                        (func.lower(Driver.slug) == lowered, 1),
                        (func.lower(Driver.driver_code) == lowered, 2),
                        else_=3,
                    ),
                    counts.c.race_entries.desc(),
                    Driver.full_name,
                )
                .limit(limit)
            )
        ).all()
        media = await GameDriverCatalogService._media(
            db, [row.Driver.id for row in rows]
        )
        return GameDriverSearchResponse(
            drivers=[
                GameDriverCatalogItem(
                    driver_slug=row.Driver.slug,
                    full_name=row.Driver.full_name,
                    driver_code=row.Driver.driver_code,
                    headshot_url=(
                        media[row.Driver.id].url
                        if row.Driver.id in media
                        else row.headshot_url
                    ),
                    media=media.get(row.Driver.id),
                    race_entries=0,
                )
                for row in rows
            ]
        )
