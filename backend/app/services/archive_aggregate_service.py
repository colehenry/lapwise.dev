"""Reads and rebuilds the archive career aggregates.

The all-time listings are the most expensive read in the archive: every request
otherwise scans every session result ever ingested. These rows are derived
data — rebuilt in one transaction after ingestion and canonical identity or
championship updates, never edited by hand, and safe to drop.
"""

from datetime import datetime, timezone

from sqlalchemy import delete, func, insert, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AggConstructorCareer, AggDriverCareer
from app.schemas.constructor import ConstructorListResponse
from app.schemas.driver import DriverListResponse
from app.services.constructor_catalog_service import ConstructorCatalogService
from app.services.driver_catalog_service import DriverCatalogService

VARIANTS = (True, False)


class ArchiveAggregateService:
    """Aggregate-backed archive listings with a live fallback."""

    @staticmethod
    async def driver_list(
        db: AsyncSession, include_sprint: bool = True
    ) -> DriverListResponse:
        rows = (
            await db.execute(
                select(AggDriverCareer)
                .where(AggDriverCareer.include_sprint == include_sprint)
                .order_by(
                    AggDriverCareer.total_wins.desc(),
                    AggDriverCareer.total_points.desc(),
                    AggDriverCareer.driver_slug,
                )
            )
        ).scalars()
        listing = [
            {
                "driver_code": row.driver_code,
                "driver_slug": row.driver_slug,
                "full_name": row.full_name,
                "country_code": row.country_code,
                "headshot_url": row.headshot_url,
                "total_wins": row.total_wins,
                "total_races": row.total_races,
                "total_podiums": row.total_podiums,
                "total_points": row.total_points,
                "current_team": row.current_team,
                "current_team_color": row.current_team_color,
                "first_season": row.first_season,
                "latest_season": row.latest_season,
            }
            for row in rows
        ]
        if not listing:
            return await DriverCatalogService.compute_all(db, include_sprint)
        return DriverCatalogService.to_response(listing)

    @staticmethod
    async def constructor_list(
        db: AsyncSession, include_sprint: bool = True
    ) -> ConstructorListResponse:
        rows = (
            await db.execute(
                select(AggConstructorCareer)
                .where(AggConstructorCareer.include_sprint == include_sprint)
                .order_by(
                    AggConstructorCareer.total_wins.desc(),
                    AggConstructorCareer.total_points.desc(),
                    AggConstructorCareer.constructor_slug,
                )
            )
        ).scalars()
        listing = [
            {
                "team_name": row.team_name,
                "constructor_slug": row.constructor_slug,
                "team_color": row.team_color,
                "logo_url": row.logo_url,
                "total_wins": row.total_wins,
                "total_races": row.total_races,
                "total_podiums": row.total_podiums,
                "total_points": row.total_points,
                "first_season": row.first_season,
                "latest_season": row.latest_season,
            }
            for row in rows
        ]
        if not listing:
            return await ConstructorCatalogService.compute_all(db, include_sprint)
        return ConstructorCatalogService.to_response(listing)

    @staticmethod
    async def rebuild(db: AsyncSession) -> dict[str, int]:
        """Recompute every aggregate row inside one transaction.

        The totals are written with INSERT ... SELECT, so the rows never leave
        the database. Either both variants of both listings are replaced or
        nothing is: a failed identity or championship backfill cannot publish a
        partially refreshed archive.
        """
        refreshed_at = datetime.now(timezone.utc)

        await db.execute(delete(AggDriverCareer))
        await db.execute(delete(AggConstructorCareer))
        for include_sprint in VARIANTS:
            await db.execute(
                ArchiveAggregateService._driver_insert(include_sprint, refreshed_at)
            )
            await db.execute(
                ArchiveAggregateService._constructor_insert(
                    include_sprint, refreshed_at
                )
            )
        await db.commit()

        return {
            "drivers": await db.scalar(
                select(func.count()).select_from(AggDriverCareer)
            )
            or 0,
            "constructors": await db.scalar(
                select(func.count()).select_from(AggConstructorCareer)
            )
            or 0,
        }

    @staticmethod
    def _driver_insert(include_sprint: bool, refreshed_at: datetime):
        source = DriverCatalogService.career_query(include_sprint).subquery()
        return insert(AggDriverCareer).from_select(
            [
                "driver_id",
                "include_sprint",
                "driver_code",
                "driver_slug",
                "full_name",
                "country_code",
                "headshot_url",
                "total_wins",
                "total_races",
                "total_podiums",
                "total_points",
                "current_team",
                "current_team_color",
                "first_season",
                "latest_season",
                "refreshed_at",
            ],
            select(
                source.c.id,
                literal(include_sprint),
                source.c.driver_code,
                source.c.slug,
                source.c.full_name,
                source.c.country_code,
                source.c.headshot_url,
                func.coalesce(source.c.total_wins, 0),
                func.coalesce(source.c.total_races, 0),
                func.coalesce(source.c.total_podiums, 0),
                func.coalesce(source.c.total_points, 0),
                source.c.current_team,
                source.c.current_team_color,
                source.c.first_season,
                source.c.latest_season,
                literal(refreshed_at),
            ),
        )

    @staticmethod
    def _constructor_insert(include_sprint: bool, refreshed_at: datetime):
        source = ConstructorCatalogService.career_query(include_sprint).subquery()
        return insert(AggConstructorCareer).from_select(
            [
                "constructor_id",
                "include_sprint",
                "team_name",
                "constructor_slug",
                "team_color",
                "logo_url",
                "total_wins",
                "total_races",
                "total_podiums",
                "total_points",
                "first_season",
                "latest_season",
                "refreshed_at",
            ],
            select(
                source.c.constructor_id,
                literal(include_sprint),
                source.c.team_name,
                source.c.constructor_slug,
                source.c.team_color,
                source.c.logo_url,
                func.coalesce(source.c.total_wins, 0),
                func.coalesce(source.c.total_races, 0),
                func.coalesce(source.c.total_podiums, 0),
                func.coalesce(source.c.total_points, 0),
                source.c.first_season,
                source.c.latest_season,
                literal(refreshed_at),
            ),
        )

    @staticmethod
    async def refreshed_at(db: AsyncSession) -> datetime | None:
        return await db.scalar(select(AggDriverCareer.refreshed_at).limit(1))
