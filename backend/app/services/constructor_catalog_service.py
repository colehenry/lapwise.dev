"""Constructor identity-level career listing."""

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import Constructor, Session, SessionResult, Team
from app.schemas.constructor import ConstructorListItem, ConstructorListResponse


class ConstructorCatalogService:
    """Live constructor career totals. The archive endpoint reads the
    aggregate table built from this computation."""

    @staticmethod
    def career_query(include_sprint: bool):
        """Career totals per canonical constructor, keyed by canonical id."""
        session_types = ("race", "sprint_race") if include_sprint else ("race",)
        wins = func.sum(case((SessionResult.position == 1, 1), else_=0))
        points = func.coalesce(func.sum(SessionResult.points), 0)
        # Latest branding per constructor, resolved set-based rather than with
        # one query per constructor.
        branding_team = aliased(Team, name="branding_team")
        branding = (
            select(
                branding_team.constructor_id.label("constructor_id"),
                branding_team.name.label("name"),
                branding_team.team_color.label("team_color"),
                branding_team.logo_url.label("logo_url"),
            )
            .distinct(branding_team.constructor_id)
            .order_by(
                branding_team.constructor_id,
                branding_team.year.desc(),
                branding_team.id.desc(),
            )
            .subquery()
        )
        query = (
            select(
                Constructor.id.label("constructor_id"),
                Constructor.slug.label("constructor_slug"),
                func.coalesce(branding.c.name, Constructor.canonical_name).label(
                    "team_name"
                ),
                branding.c.team_color.label("team_color"),
                branding.c.logo_url.label("logo_url"),
                func.count(SessionResult.id).label("total_races"),
                wins.label("total_wins"),
                func.sum(
                    case((SessionResult.position.in_([1, 2, 3]), 1), else_=0)
                ).label("total_podiums"),
                points.label("total_points"),
                func.min(Session.year).label("first_season"),
                func.max(Session.year).label("latest_season"),
            )
            .join(Team, Team.constructor_id == Constructor.id)
            .join(SessionResult, SessionResult.team_id == Team.id)
            .join(Session, Session.id == SessionResult.session_id)
            .outerjoin(branding, branding.c.constructor_id == Constructor.id)
            .where(Session.session_type.in_(session_types))
            .group_by(
                Constructor.id,
                branding.c.name,
                branding.c.team_color,
                branding.c.logo_url,
            )
            # Slug breaks ties so the listing is stable between requests.
            .order_by(wins.desc(), points.desc(), Constructor.slug)
        )
        return query

    @staticmethod
    async def compute_rows(db: AsyncSession, include_sprint: bool) -> list[dict]:
        rows = (
            await db.execute(ConstructorCatalogService.career_query(include_sprint))
        ).all()
        return [
            {
                "constructor_id": row.constructor_id,
                "team_name": row.team_name,
                "constructor_slug": row.constructor_slug,
                "team_color": row.team_color,
                "logo_url": row.logo_url,
                "total_races": int(row.total_races),
                "total_wins": int(row.total_wins or 0),
                "total_podiums": int(row.total_podiums or 0),
                "total_points": float(row.total_points),
                "first_season": row.first_season,
                "latest_season": row.latest_season,
            }
            for row in rows
        ]

    @staticmethod
    def to_response(rows: list[dict]) -> ConstructorListResponse:
        constructors = [
            ConstructorListItem(
                **{key: row[key] for key in row if key != "constructor_id"}
            )
            for row in rows
        ]
        return ConstructorListResponse(
            constructors=constructors, total=len(constructors)
        )

    @staticmethod
    async def compute_all(
        db: AsyncSession, include_sprint: bool = True
    ) -> ConstructorListResponse:
        return ConstructorCatalogService.to_response(
            await ConstructorCatalogService.compute_rows(db, include_sprint)
        )
