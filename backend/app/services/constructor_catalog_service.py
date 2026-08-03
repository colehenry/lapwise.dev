"""Constructor identity-level career listing."""

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Constructor, Session, SessionResult, Team
from app.schemas.constructor import ConstructorListItem, ConstructorListResponse


class ConstructorCatalogService:
    @staticmethod
    async def get_all(
        db: AsyncSession, include_sprint: bool
    ) -> ConstructorListResponse:
        session_types = ("race", "sprint_race") if include_sprint else ("race",)
        rows = (
            await db.execute(
                select(
                    Constructor.id,
                    Constructor.slug,
                    Constructor.canonical_name,
                    func.count(SessionResult.id),
                    func.sum(case((SessionResult.position == 1, 1), else_=0)),
                    func.sum(case((SessionResult.position.in_([1, 2, 3]), 1), else_=0)),
                    func.coalesce(func.sum(SessionResult.points), 0),
                    func.min(Session.year),
                    func.max(Session.year),
                )
                .join(Team, Team.constructor_id == Constructor.id)
                .join(SessionResult, SessionResult.team_id == Team.id)
                .join(Session, Session.id == SessionResult.session_id)
                .where(Session.session_type.in_(session_types))
                .group_by(Constructor.id)
                .order_by(
                    func.sum(case((SessionResult.position == 1, 1), else_=0)).desc(),
                    func.coalesce(func.sum(SessionResult.points), 0).desc(),
                )
            )
        ).all()
        output = []
        for row in rows:
            branding = (
                await db.execute(
                    select(Team.team_color, Team.logo_url, Team.name)
                    .where(Team.constructor_id == row[0])
                    .order_by(Team.year.desc())
                    .limit(1)
                )
            ).first()
            output.append(
                ConstructorListItem(
                    team_name=branding.name if branding else row[2],
                    constructor_slug=row[1],
                    team_color=branding.team_color if branding else None,
                    logo_url=branding.logo_url if branding else None,
                    total_races=int(row[3]),
                    total_wins=int(row[4] or 0),
                    total_podiums=int(row[5] or 0),
                    total_points=float(row[6]),
                    first_season=row[7],
                    latest_season=row[8],
                )
            )
        return ConstructorListResponse(constructors=output, total=len(output))
