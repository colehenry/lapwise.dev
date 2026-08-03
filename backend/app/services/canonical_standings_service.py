"""Official championship classifications merged with on-track point totals."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ChampionshipClassificationException,
    ChampionshipScoringContext,
    Constructor,
    ConstructorChampionshipStanding,
    Driver,
    DriverChampionshipStanding,
    DriverSeason,
    Session,
    SessionResult,
    Team,
)
from app.schemas.result import (
    ChampionshipScoringInfo,
    ConstructorStanding,
    DriverStanding,
    StandingsResponse,
)
from app.services.championship_errors import MissingCanonicalStandingsError
from app.services.results.common import headshot_fallback_expr


class CanonicalStandingsService:
    """Build the public standings response from canonical and observed data."""

    RACE_TYPES = ("race", "sprint_race")

    @staticmethod
    async def get_season_standings(
        db: AsyncSession, season: int
    ) -> StandingsResponse | None:
        exists = await db.scalar(
            select(Session.id).where(Session.year == season).limit(1)
        )
        if exists is None:
            return None

        driver_raw = await CanonicalStandingsService._driver_raw(db, season)
        constructor_raw = await CanonicalStandingsService._constructor_raw(db, season)
        driver_official = {
            row.driver_id: row
            for row in (
                await db.scalars(
                    select(DriverChampionshipStanding).where(
                        DriverChampionshipStanding.year == season
                    )
                )
            ).all()
        }
        constructor_official = {
            row.team_id: row
            for row in (
                await db.scalars(
                    select(ConstructorChampionshipStanding).where(
                        ConstructorChampionshipStanding.year == season
                    )
                )
            ).all()
        }

        constructor_required = season >= 1958
        completed = season < date.today().year
        driver_snapshot_final = any(row.is_final for row in driver_official.values())
        constructor_snapshot_final = any(
            row.is_final for row in constructor_official.values()
        )
        if completed and (
            not driver_snapshot_final
            or (constructor_required and not constructor_snapshot_final)
        ):
            missing = []
            if not driver_snapshot_final:
                missing.append("driver")
            if constructor_required and not constructor_snapshot_final:
                missing.append("constructor")
            raise MissingCanonicalStandingsError(
                f"Completed season {season} is missing canonical {' and '.join(missing)} standings"
            )

        contexts = {
            row.entrant_type: row
            for row in (
                await db.scalars(
                    select(ChampionshipScoringContext).where(
                        ChampionshipScoringContext.year == season
                    )
                )
            ).all()
        }
        exceptions = (
            await db.scalars(
                select(ChampionshipClassificationException).where(
                    ChampionshipClassificationException.year == season
                )
            )
        ).all()
        driver_exceptions = {row.driver_id: row for row in exceptions if row.driver_id}
        constructor_exceptions = {row.team_id: row for row in exceptions if row.team_id}
        drivers = []
        for raw_rank, row in enumerate(driver_raw, 1):
            official = driver_official.get(row["driver_id"])
            exception = driver_exceptions.get(row["driver_id"])
            status = (
                exception.status
                if exception
                else "classified"
                if official and official.is_final
                else "not_classified"
                if completed and official is None
                else "provisional"
            )
            championship_points = (
                float(official.championship_points)
                if official
                else None
                if completed
                else row["points_scored"]
            )
            position = (
                official.position if official else None if completed else raw_rank
            )
            if exception:
                position = None
                championship_points = None
            explanation = exception.explanation if exception else None
            if (
                not explanation
                and official
                and championship_points != row["points_scored"]
            ):
                context = contexts.get("driver")
                explanation = context.explanation if context else None
            drivers.append(
                DriverStanding(
                    position=position,
                    driver_code=row["driver_code"],
                    driver_slug=row["driver_slug"],
                    full_name=row["full_name"],
                    country_code=row["country_code"],
                    team_name=row["team_name"],
                    team_color=row["team_color"],
                    total_points=championship_points or 0,
                    championship_points=championship_points,
                    points_scored=row["points_scored"],
                    classification_status=status,
                    scoring_explanation=explanation,
                    scoring_explanation_url=(
                        exception.source_url
                        if exception
                        else official.source_url
                        if explanation and official
                        else None
                    ),
                    headshot_url=row["headshot_url"],
                    wins=row["positions"].get(1, 0),
                    p2s=row["positions"].get(2, 0),
                    p3s=row["positions"].get(3, 0),
                    position_counts=row["positions"],
                )
            )
        drivers.sort(key=lambda row: (row.position is None, row.position or 10_000))

        constructors = []
        raw_by_team = {row["team_id"]: row for row in constructor_raw}
        all_team_ids = list(raw_by_team)
        for team_id in constructor_exceptions:
            if team_id not in raw_by_team:
                all_team_ids.append(team_id)
        for raw_rank, team_id in enumerate(all_team_ids, 1):
            row = raw_by_team.get(team_id)
            if row is None:
                continue
            official = constructor_official.get(team_id)
            exception = constructor_exceptions.get(team_id)
            context = contexts.get("constructor")
            status = (
                exception.status
                if exception
                else "classified"
                if official and official.is_final
                else "not_classified"
                if completed and official is None
                else "provisional"
            )
            championship_points = (
                float(official.championship_points)
                if official
                else None
                if completed
                else row["points_scored"]
            )
            position = (
                official.position if official else None if completed else raw_rank
            )
            if exception:
                position = None
                championship_points = None
            elif context and context.kind == "not_held":
                status = "not_classified"
                position = None
                championship_points = None
            explanation = exception.explanation if exception else None
            if not explanation and context and context.kind == "not_held":
                explanation = context.explanation
            if (
                not explanation
                and official
                and championship_points != row["points_scored"]
            ):
                explanation = context.explanation if context else None
            constructors.append(
                ConstructorStanding(
                    position=position,
                    team_name=row["team_name"],
                    constructor_slug=row["constructor_slug"],
                    team_color=row["team_color"],
                    logo_url=row["logo_url"],
                    total_points=championship_points or 0,
                    championship_points=championship_points,
                    points_scored=(
                        float(exception.points_scored)
                        if exception and exception.points_scored is not None
                        else row["points_scored"]
                    ),
                    classification_status=status,
                    scoring_explanation=explanation,
                    scoring_explanation_url=(
                        exception.source_url
                        if exception
                        else official.source_url
                        if explanation and official
                        else None
                    ),
                    wins=row["positions"].get(1, 0),
                    p2s=row["positions"].get(2, 0),
                    p3s=row["positions"].get(3, 0),
                    position_counts=row["positions"],
                )
            )
        constructors.sort(
            key=lambda row: (row.position is None, row.position or 10_000)
        )

        return StandingsResponse(
            year=season,
            drivers=drivers,
            constructors=constructors,
            driver_scoring=CanonicalStandingsService._scoring_info(
                contexts.get("driver"), drivers
            ),
            constructor_scoring=CanonicalStandingsService._scoring_info(
                contexts.get("constructor"), constructors
            ),
        )

    @staticmethod
    def _scoring_info(context, rows) -> ChampionshipScoringInfo:
        has_discrepancy = any(
            row.championship_points is not None
            and abs(row.championship_points - row.points_scored) > 0.0001
            for row in rows
        )
        row_explanation = next(
            (row.scoring_explanation for row in rows if row.scoring_explanation),
            None,
        )
        row_source_url = next(
            (
                row.scoring_explanation_url
                for row in rows
                if row.scoring_explanation_url
            ),
            None,
        )
        is_provisional = any(row.classification_status == "provisional" for row in rows)
        if is_provisional and context is None:
            return ChampionshipScoringInfo(
                kind="provisional",
                short_label="Provisional standings",
                explanation=(
                    "These standings are provisional because the season is still in "
                    "progress. Positions and points may change as remaining rounds are "
                    "completed."
                ),
                source_url=None,
                comparison_mode="none",
                has_discrepancy=has_discrepancy,
            )
        return ChampionshipScoringInfo(
            kind=(
                context.kind
                if context
                else "classification_exception"
                if row_explanation
                else "standard"
            ),
            short_label=(
                context.short_label
                if context
                else "Classification exception"
                if row_explanation
                else None
            ),
            explanation=context.explanation if context else row_explanation,
            source_url=row_source_url,
            comparison_mode=(
                context.comparison_mode
                if context
                else "note_only"
                if row_explanation
                else "none"
            ),
            has_discrepancy=has_discrepancy,
        )

    @staticmethod
    async def _position_counts(
        db: AsyncSession, season: int, owner_column, result_owner_column
    ):
        rows = await db.execute(
            select(owner_column, SessionResult.position, func.count())
            .join(SessionResult, owner_column == result_owner_column)
            .join(Session, SessionResult.session_id == Session.id)
            .where(
                Session.year == season,
                Session.session_type.in_(CanonicalStandingsService.RACE_TYPES),
                SessionResult.position.is_not(None),
            )
            .group_by(owner_column, SessionResult.position)
        )
        counts = {}
        for owner_id, position, count in rows:
            counts.setdefault(owner_id, {})[int(position)] = int(count)
        return counts

    @staticmethod
    async def _driver_raw(db: AsyncSession, season: int) -> list[dict]:
        counts = await CanonicalStandingsService._position_counts(
            db, season, Driver.id, SessionResult.driver_id
        )
        totals = (
            await db.execute(
                select(
                    Driver.id,
                    Driver.slug,
                    Driver.full_name,
                    Driver.country_code,
                    Driver.driver_code,
                    DriverSeason.driver_code,
                    func.coalesce(func.sum(SessionResult.points), 0),
                )
                .join(SessionResult, SessionResult.driver_id == Driver.id)
                .join(Session, Session.id == SessionResult.session_id)
                .outerjoin(
                    DriverSeason,
                    (DriverSeason.driver_id == Driver.id)
                    & (DriverSeason.year == season),
                )
                .where(
                    Session.year == season,
                    Session.session_type.in_(CanonicalStandingsService.RACE_TYPES),
                )
                .group_by(Driver.id, DriverSeason.driver_code)
                .order_by(func.coalesce(func.sum(SessionResult.points), 0).desc())
            )
        ).all()
        output = []
        for row in totals:
            latest = (
                await db.execute(
                    select(Team.name, Team.team_color, headshot_fallback_expr())
                    .join(SessionResult, SessionResult.team_id == Team.id)
                    .join(Session, Session.id == SessionResult.session_id)
                    .join(Driver, Driver.id == SessionResult.driver_id)
                    .where(SessionResult.driver_id == row[0], Session.year == season)
                    .order_by(Session.date.desc(), Session.round.desc())
                    .limit(1)
                )
            ).first()
            output.append(
                {
                    "driver_id": row[0],
                    "driver_slug": row[1],
                    "full_name": row[2],
                    "country_code": row[3],
                    "driver_code": row[5] or row[4],
                    "points_scored": float(row[6]),
                    "team_name": latest[0] if latest else "Unknown",
                    "team_color": latest[1] if latest else None,
                    "headshot_url": latest[2] if latest else None,
                    "positions": counts.get(row[0], {}),
                }
            )
        return output

    @staticmethod
    async def _constructor_raw(db: AsyncSession, season: int) -> list[dict]:
        counts = await CanonicalStandingsService._position_counts(
            db, season, Team.id, SessionResult.team_id
        )
        rows = (
            await db.execute(
                select(
                    Team.id,
                    Team.name,
                    Team.team_color,
                    Team.logo_url,
                    Constructor.slug,
                    func.coalesce(func.sum(SessionResult.points), 0),
                )
                .join(Constructor, Constructor.id == Team.constructor_id)
                .join(SessionResult, SessionResult.team_id == Team.id)
                .join(Session, Session.id == SessionResult.session_id)
                .where(
                    Session.year == season,
                    Session.session_type.in_(CanonicalStandingsService.RACE_TYPES),
                )
                .group_by(Team.id, Constructor.slug)
                .order_by(func.coalesce(func.sum(SessionResult.points), 0).desc())
            )
        ).all()
        return [
            {
                "team_id": row[0],
                "team_name": row[1],
                "team_color": row[2],
                "logo_url": row[3],
                "constructor_slug": row[4],
                "points_scored": float(row[5]),
                "positions": counts.get(row[0], {}),
            }
            for row in rows
        ]
