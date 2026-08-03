"""Constructor identity-level career listing."""

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import Constructor, Session, SessionResult, Team
from app.schemas.constructor import ConstructorListItem, ConstructorListResponse


class ConstructorCatalogService:
    @staticmethod
    async def get_all(
        db: AsyncSession, include_sprint: bool
    ) -> ConstructorListResponse:
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
        rows = (
            await db.execute(
                select(
                    Constructor.id,
                    Constructor.slug,
                    Constructor.canonical_name,
                    func.count(SessionResult.id),
                    wins,
                    func.sum(case((SessionResult.position.in_([1, 2, 3]), 1), else_=0)),
                    points,
                    func.min(Session.year),
                    func.max(Session.year),
                    branding.c.name,
                    branding.c.team_color,
                    branding.c.logo_url,
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
        ).all()
        return ConstructorListResponse(
            constructors=[
                ConstructorListItem(
                    team_name=row[9] if row[9] is not None else row[2],
                    constructor_slug=row[1],
                    team_color=row[10],
                    logo_url=row[11],
                    total_races=int(row[3]),
                    total_wins=int(row[4] or 0),
                    total_podiums=int(row[5] or 0),
                    total_points=float(row[6]),
                    first_season=row[7],
                    latest_season=row[8],
                )
                for row in rows
            ],
            total=len(rows),
        )
