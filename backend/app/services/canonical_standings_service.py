"""Official championship classifications merged with on-track point totals."""

from datetime import date

from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

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
from app.services.results.common import as_records, json_rows


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
        canonical = await CanonicalStandingsService._canonical_records(db, season)
        driver_official = {row.driver_id: row for row in canonical["driver_official"]}
        constructor_official = {
            row.team_id: row for row in canonical["constructor_official"]
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

        contexts = {row.entrant_type: row for row in canonical["contexts"]}
        exceptions = canonical["exceptions"]
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
    async def _canonical_records(db: AsyncSession, season: int) -> dict:
        """Official standings, scoring contexts, and exceptions in one statement."""

        def for_season(model, alias_name):
            return json_rows(model, alias_name, lambda m: (m.year == season,))

        record = (
            await db.execute(
                select(
                    for_season(DriverChampionshipStanding, "dcs").label(
                        "driver_official"
                    ),
                    for_season(ConstructorChampionshipStanding, "ccs").label(
                        "constructor_official"
                    ),
                    for_season(ChampionshipScoringContext, "csc").label("contexts"),
                    for_season(ChampionshipClassificationException, "cce").label(
                        "exceptions"
                    ),
                )
            )
        ).one()
        return {
            key: as_records(getattr(record, key))
            for key in (
                "driver_official",
                "constructor_official",
                "contexts",
                "exceptions",
            )
        }

    @staticmethod
    def _position_counts_subquery(season: int, owner_column, result_owner_column):
        """One row per entrant holding a JSON map of finishing position to count."""
        counts = (
            select(
                owner_column.label("owner_id"),
                SessionResult.position.label("position"),
                func.count().label("total"),
            )
            .join(SessionResult, owner_column == result_owner_column)
            .join(Session, SessionResult.session_id == Session.id)
            .where(
                Session.year == season,
                Session.session_type.in_(CanonicalStandingsService.RACE_TYPES),
                SessionResult.position.is_not(None),
            )
            .group_by(owner_column, SessionResult.position)
            .subquery()
        )
        return (
            select(
                counts.c.owner_id,
                func.jsonb_object_agg(
                    cast(counts.c.position, String), counts.c.total
                ).label("positions"),
            )
            .group_by(counts.c.owner_id)
            .subquery()
        )

    @staticmethod
    def _position_counts(positions) -> dict[int, int]:
        return {int(key): int(value) for key, value in (positions or {}).items()}

    @staticmethod
    def _latest_headshot_subquery():
        """Latest valid headshot for the outer driver row, across all seasons."""
        result = aliased(SessionResult, name="headshot_result")
        session = aliased(Session, name="headshot_session")
        return (
            select(result.headshot_url)
            .join(session, result.session_id == session.id)
            .where(
                result.driver_id == Driver.id,
                result.headshot_url.isnot(None),
                result.headshot_url != "None",
                result.headshot_url != "nan",
                result.headshot_url != "",
            )
            .order_by(session.date.desc(), session.round.desc())
            .limit(1)
            .correlate(Driver)
            .scalar_subquery()
        )

    @staticmethod
    async def _driver_raw(db: AsyncSession, season: int) -> list[dict]:
        positions = CanonicalStandingsService._position_counts_subquery(
            season, Driver.id, SessionResult.driver_id
        )
        # Latest scoring entry per driver in the season, resolved set-based
        # rather than with one query per driver. Restricted to the session types
        # these standings are built from, so a one-off practice entry for
        # another team cannot become the driver's listed team.
        entry_result = aliased(SessionResult, name="entry_result")
        entry_session = aliased(Session, name="entry_session")
        latest = (
            select(
                entry_result.driver_id.label("driver_id"),
                Team.name.label("team_name"),
                Team.team_color.label("team_color"),
                entry_result.headshot_url.label("headshot_url"),
            )
            .join(entry_session, entry_session.id == entry_result.session_id)
            .join(Team, Team.id == entry_result.team_id)
            .where(
                entry_session.year == season,
                entry_session.session_type.in_(CanonicalStandingsService.RACE_TYPES),
            )
            .distinct(entry_result.driver_id)
            .order_by(
                entry_result.driver_id,
                entry_session.date.desc(),
                entry_session.round.desc(),
                entry_session.id.desc(),
            )
            .subquery()
        )
        headshot = func.coalesce(
            func.nullif(
                func.nullif(func.nullif(latest.c.headshot_url, "None"), "nan"), ""
            ),
            CanonicalStandingsService._latest_headshot_subquery(),
        )
        points = func.coalesce(func.sum(SessionResult.points), 0)
        rows = (
            await db.execute(
                select(
                    Driver.id,
                    Driver.slug,
                    Driver.full_name,
                    Driver.country_code,
                    Driver.driver_code,
                    DriverSeason.driver_code,
                    points,
                    latest.c.team_name,
                    latest.c.team_color,
                    headshot,
                    positions.c.positions,
                )
                .join(SessionResult, SessionResult.driver_id == Driver.id)
                .join(Session, Session.id == SessionResult.session_id)
                .outerjoin(
                    DriverSeason,
                    (DriverSeason.driver_id == Driver.id)
                    & (DriverSeason.year == season),
                )
                .outerjoin(latest, latest.c.driver_id == Driver.id)
                .outerjoin(positions, positions.c.owner_id == Driver.id)
                .where(
                    Session.year == season,
                    Session.session_type.in_(CanonicalStandingsService.RACE_TYPES),
                )
                .group_by(
                    Driver.id,
                    DriverSeason.driver_code,
                    latest.c.team_name,
                    latest.c.team_color,
                    latest.c.headshot_url,
                    positions.c.positions,
                )
                .order_by(points.desc())
            )
        ).all()
        return [
            {
                "driver_id": row[0],
                "driver_slug": row[1],
                "full_name": row[2],
                "country_code": row[3],
                "driver_code": row[5] or row[4],
                "points_scored": float(row[6]),
                "team_name": row[7] if row[7] is not None else "Unknown",
                "team_color": row[8],
                "headshot_url": row[9],
                "positions": CanonicalStandingsService._position_counts(row[10]),
            }
            for row in rows
        ]

    @staticmethod
    async def _constructor_raw(db: AsyncSession, season: int) -> list[dict]:
        positions = CanonicalStandingsService._position_counts_subquery(
            season, Team.id, SessionResult.team_id
        )
        points = func.coalesce(func.sum(SessionResult.points), 0)
        rows = (
            await db.execute(
                select(
                    Team.id,
                    Team.name,
                    Team.team_color,
                    Team.logo_url,
                    Constructor.slug,
                    points,
                    positions.c.positions,
                )
                .join(Constructor, Constructor.id == Team.constructor_id)
                .join(SessionResult, SessionResult.team_id == Team.id)
                .join(Session, Session.id == SessionResult.session_id)
                .outerjoin(positions, positions.c.owner_id == Team.id)
                .where(
                    Session.year == season,
                    Session.session_type.in_(CanonicalStandingsService.RACE_TYPES),
                )
                .group_by(Team.id, Constructor.slug, positions.c.positions)
                .order_by(points.desc())
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
                "positions": CanonicalStandingsService._position_counts(row[6]),
            }
            for row in rows
        ]
