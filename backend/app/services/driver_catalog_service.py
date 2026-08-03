"""All-time driver listing computed from session results."""

from typing import List

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Driver, Session, SessionResult, Team
from app.schemas.driver import DriverListItem, DriverListResponse


class DriverCatalogService:
    """Live driver career totals. The archive endpoint reads the aggregate
    table built from this computation."""

    @staticmethod
    def _session_types(include_sprint: bool) -> List[str]:
        return ["race", "sprint_race"] if include_sprint else ["race"]

    @staticmethod
    def career_query(include_sprint: bool):
        """Career totals per driver, keyed by canonical driver id."""
        session_types = DriverCatalogService._session_types(include_sprint)
        session_types = DriverCatalogService._session_types(include_sprint)

        latest_session_sq = (
            select(
                SessionResult.driver_id,
                func.max(Session.date).label("max_date"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .group_by(SessionResult.driver_id)
            .subquery()
        )

        latest_info_sq = (
            select(
                SessionResult.driver_id,
                SessionResult.headshot_url,
                Session.year.label("latest_season"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .join(
                latest_session_sq,
                (SessionResult.driver_id == latest_session_sq.c.driver_id)
                & (Session.date == latest_session_sq.c.max_date),
            )
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .distinct(SessionResult.driver_id)
            .subquery()
        )

        team_seasons_sq = (
            select(
                SessionResult.driver_id,
                SessionResult.team_id,
                func.count(func.distinct(Session.year)).label("season_count"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.session_type.in_(session_types))
            .group_by(SessionResult.driver_id, SessionResult.team_id)
            .subquery()
        )

        max_team_seasons_sq = (
            select(
                team_seasons_sq.c.driver_id,
                func.max(team_seasons_sq.c.season_count).label("max_seasons"),
            )
            .group_by(team_seasons_sq.c.driver_id)
            .subquery()
        )

        primary_team_sq = (
            select(
                team_seasons_sq.c.driver_id,
                Team.name.label("team_name"),
                Team.team_color.label("team_color"),
            )
            .join(Team, team_seasons_sq.c.team_id == Team.id)
            .join(
                max_team_seasons_sq,
                (team_seasons_sq.c.driver_id == max_team_seasons_sq.c.driver_id)
                & (team_seasons_sq.c.season_count == max_team_seasons_sq.c.max_seasons),
            )
            .distinct(team_seasons_sq.c.driver_id)
            .order_by(team_seasons_sq.c.driver_id, team_seasons_sq.c.team_id.desc())
            .subquery()
        )

        query = (
            select(
                Driver.id,
                Driver.slug,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                func.count(SessionResult.id).label("total_races"),
                func.sum(case((SessionResult.position == 1, 1), else_=0)).label(
                    "total_wins"
                ),
                func.sum(
                    case(
                        (SessionResult.position.in_([1, 2, 3]), 1),
                        else_=0,
                    )
                ).label("total_podiums"),
                func.coalesce(func.sum(SessionResult.points), 0).label("total_points"),
                primary_team_sq.c.team_name.label("current_team"),
                primary_team_sq.c.team_color.label("current_team_color"),
                latest_info_sq.c.headshot_url,
                latest_info_sq.c.latest_season,
                func.min(Session.year).label("first_season"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .outerjoin(primary_team_sq, Driver.id == primary_team_sq.c.driver_id)
            .outerjoin(latest_info_sq, Driver.id == latest_info_sq.c.driver_id)
            .where(Session.session_type.in_(session_types))
            .group_by(
                Driver.id,
                Driver.slug,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                primary_team_sq.c.team_name,
                primary_team_sq.c.team_color,
                latest_info_sq.c.headshot_url,
                latest_info_sq.c.latest_season,
            )
            .order_by(
                func.sum(case((SessionResult.position == 1, 1), else_=0)).desc(),
                func.coalesce(func.sum(SessionResult.points), 0).desc(),
                # Slug breaks ties so the listing is stable between requests.
                Driver.slug,
            )
        )

        return query

    @staticmethod
    async def compute_rows(db: AsyncSession, include_sprint: bool) -> list[dict]:
        rows = (
            await db.execute(DriverCatalogService.career_query(include_sprint))
        ).all()

        return [
            {
                "driver_id": row.id,
                "driver_code": row.driver_code,
                "driver_slug": row.slug,
                "full_name": row.full_name,
                "country_code": row.country_code,
                "headshot_url": row.headshot_url,
                "total_wins": int(row.total_wins or 0),
                "total_races": int(row.total_races or 0),
                "total_podiums": int(row.total_podiums or 0),
                "total_points": float(row.total_points or 0),
                "current_team": row.current_team,
                "current_team_color": row.current_team_color,
                "first_season": row.first_season,
                "latest_season": row.latest_season,
            }
            for row in rows
        ]

    @staticmethod
    def to_response(rows: list[dict]) -> DriverListResponse:
        drivers = [
            DriverListItem(**{key: row[key] for key in row if key != "driver_id"})
            for row in rows
        ]
        return DriverListResponse(drivers=drivers, total=len(drivers))

    @staticmethod
    async def compute_all(
        db: AsyncSession, include_sprint: bool = True
    ) -> DriverListResponse:
        return DriverCatalogService.to_response(
            await DriverCatalogService.compute_rows(db, include_sprint)
        )
