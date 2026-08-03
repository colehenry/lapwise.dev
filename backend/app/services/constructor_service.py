from datetime import date
from typing import List, Optional

from sqlalchemy import case, distinct, func, literal_column, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ChampionshipClassificationException,
    ChampionshipScoringContext,
    Constructor,
    ConstructorChampionshipStanding,
    ConstructorExternalId,
    Driver,
    Session,
    SessionResult,
    Team,
)
from app.schemas.constructor import (
    ConstructorListResponse,
    ConstructorProfileResponse,
    ConstructorRaceHistory,
    ConstructorRaceHistoryResponse,
    ConstructorSeasonHistory,
    ConstructorSeasonHistoryResponse,
)
from app.services.championship_errors import MissingCanonicalStandingsError
from app.services.constructor_catalog_service import ConstructorCatalogService
from app.services.results.common import _make_slug, as_records, json_rows


class ConstructorService:
    """Service for constructor-related operations"""

    @staticmethod
    def _session_types(include_sprint: bool) -> List[str]:
        return ["race", "sprint_race"] if include_sprint else ["race"]

    @staticmethod
    async def get_all_constructors(
        db: AsyncSession, include_sprint: bool = True
    ) -> ConstructorListResponse:
        """Get constructor identities with career statistics."""
        return await ConstructorCatalogService.get_all(db, include_sprint)

    @staticmethod
    async def get_constructor_profile(
        db: AsyncSession, team_name: str, include_sprint: bool = True
    ) -> Optional[ConstructorProfileResponse]:
        """
        Get complete constructor profile with career statistics.
        """
        identity = await ConstructorService._resolve_identity(db, team_name)
        if not identity:
            return None

        team_ids = select(Team.id).where(Team.constructor_id == identity.constructor_id)
        # Career statistics are aggregated in the database; the profile never
        # needed the underlying result rows.
        races = func.count(
            distinct(tuple_(Session.year, Session.round, Session.session_type))
        )
        stats = (
            await db.execute(
                select(
                    func.count(distinct(Session.year)).label("total_seasons"),
                    races.label("total_races"),
                    func.coalesce(
                        func.sum(case((SessionResult.position == 1, 1), else_=0)), 0
                    ).label("total_wins"),
                    func.coalesce(
                        func.sum(
                            case((SessionResult.position.in_([1, 2, 3]), 1), else_=0)
                        ),
                        0,
                    ).label("total_podiums"),
                    func.coalesce(func.sum(SessionResult.points), 0.0).label(
                        "total_points"
                    ),
                    func.min(SessionResult.position).label("best_finish"),
                    func.max(Session.year).label("latest_season"),
                    select(func.count())
                    .select_from(ConstructorChampionshipStanding)
                    .where(
                        ConstructorChampionshipStanding.team_id.in_(team_ids),
                        ConstructorChampionshipStanding.position == 1,
                        ConstructorChampionshipStanding.is_final.is_(True),
                    )
                    .scalar_subquery()
                    .label("total_championships"),
                )
                .select_from(SessionResult)
                .join(Session, SessionResult.session_id == Session.id)
                .where(
                    SessionResult.team_id.in_(team_ids),
                    Session.session_type.in_(
                        ConstructorService._session_types(include_sprint)
                    ),
                )
            )
        ).one()

        if stats.total_races == 0:
            return ConstructorProfileResponse(
                team_name=identity.team_name,
                constructor_slug=identity.constructor_slug,
                team_color=identity.team_color,
                total_seasons=0,
                total_races=0,
                total_championships=0,
                total_wins=0,
                total_podiums=0,
                total_points=0.0,
                best_finish=None,
                latest_season=None,
            )

        return ConstructorProfileResponse(
            team_name=identity.team_name,
            constructor_slug=identity.constructor_slug,
            team_color=identity.team_color,
            logo_url=identity.logo_url,
            total_seasons=int(stats.total_seasons),
            total_races=int(stats.total_races),
            total_championships=int(stats.total_championships or 0),
            total_wins=int(stats.total_wins),
            total_podiums=int(stats.total_podiums),
            total_points=float(stats.total_points),
            best_finish=stats.best_finish,
            latest_season=stats.latest_season,
        )

    @staticmethod
    async def get_season_history(
        db: AsyncSession, team_name: str
    ) -> Optional[ConstructorSeasonHistoryResponse]:
        """
        Get constructor's championship position and points for each season.
        """
        identity = await ConstructorService._resolve_identity(db, team_name)
        if not identity:
            return None
        constructor_slug = identity.constructor_slug

        # Year -> (team id, color) for this constructor's year-specific records
        rows = (
            await db.execute(
                select(Team.id, Team.year, Team.team_color).where(
                    Team.constructor_id == identity.constructor_id
                )
            )
        ).all()
        team_data_map = {row.year: (row.id, row.team_color) for row in rows}
        team_ids = [tid for tid, _ in team_data_map.values()]

        # Get aggregated results
        season_data = await ConstructorService._get_season_aggregated_results(
            db, team_ids
        )

        if not season_data:
            return ConstructorSeasonHistoryResponse(
                team_name=identity.team_name,
                constructor_slug=constructor_slug,
                seasons=[],
            )

        years = [row.year for row in season_data]
        canonical = (
            await db.execute(
                select(
                    json_rows(
                        ConstructorChampionshipStanding,
                        "ccs",
                        lambda m: (m.team_id.in_(team_ids), m.year.in_(years)),
                    ).label("official"),
                    select(
                        func.coalesce(
                            func.jsonb_agg(
                                distinct(ConstructorChampionshipStanding.year)
                            ),
                            literal_column("'[]'::jsonb"),
                        )
                    )
                    .where(
                        ConstructorChampionshipStanding.year.in_(years),
                        ConstructorChampionshipStanding.is_final.is_(True),
                    )
                    .scalar_subquery()
                    .label("snapshot_years"),
                    json_rows(
                        ChampionshipScoringContext,
                        "csc",
                        lambda m: (
                            m.entrant_type == "constructor",
                            m.year.in_(years),
                        ),
                    ).label("contexts"),
                    json_rows(
                        ChampionshipClassificationException,
                        "cce",
                        lambda m: (m.team_id.in_(team_ids), m.year.in_(years)),
                    ).label("exceptions"),
                )
            )
        ).one()
        official = {row.team_id: row for row in as_records(canonical.official)}
        snapshot_years = set(canonical.snapshot_years or [])
        contexts = {row.year: row for row in as_records(canonical.contexts)}
        exceptions = {row.team_id: row for row in as_records(canonical.exceptions)}
        missing_years = [
            year
            for year in years
            if 1958 <= year < date.today().year and year not in snapshot_years
        ]
        if missing_years:
            raise MissingCanonicalStandingsError(
                "Completed constructor seasons are missing canonical standings: "
                + ", ".join(str(year) for year in missing_years)
            )
        seasons = []
        for season_row in season_data:
            year = season_row.year
            team_id_for_year = team_data_map.get(year, (None, None))[0]
            standing = official.get(team_id_for_year)
            exception = exceptions.get(team_id_for_year)
            context = contexts.get(year)
            scored = float(season_row.total_points)
            not_held = context is not None and context.kind == "not_held"
            championship_points = (
                None
                if exception or not_held
                else float(standing.championship_points)
                if standing
                else None
                if year < date.today().year
                else scored
            )

            seasons.append(
                ConstructorSeasonHistory(
                    year=year,
                    championship_position=(
                        None
                        if exception or not_held
                        else standing.position
                        if standing
                        else None
                    ),
                    total_points=championship_points or 0,
                    championship_points=championship_points,
                    points_scored=scored,
                    classification_status=(
                        exception.status
                        if exception
                        else "not_classified"
                        if not_held
                        else "classified"
                        if standing and standing.is_final
                        else "not_classified"
                        if year < date.today().year
                        else "provisional"
                    ),
                    scoring_explanation=(
                        exception.explanation
                        if exception
                        else context.explanation
                        if context
                        and (
                            not_held
                            or standing
                            and float(standing.championship_points) != scored
                        )
                        else None
                    ),
                    race_count=int(season_row.race_count or 0),
                    team_color=team_data_map.get(year, (None, None))[1],
                )
            )

        return ConstructorSeasonHistoryResponse(
            team_name=identity.team_name,
            constructor_slug=constructor_slug,
            seasons=seasons,
        )

    @staticmethod
    async def get_race_history(
        db: AsyncSession,
        team_name: str,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
        fetch_all: bool = False,
        include_sprint: bool = True,
    ) -> Optional[ConstructorRaceHistoryResponse]:
        """
        Get constructor's race-by-race results across their career.
        """
        team_name_normalized = team_name
        team = await ConstructorService._get_team_by_name(db, team_name_normalized)
        if not team:
            return None

        # Get team ID map
        all_teams_result = await ConstructorService._get_all_teams_info(
            db, team_name_normalized
        )
        team_data_map = {row.year: row.id for row in all_teams_result}

        available_years = sorted(team_data_map.keys(), reverse=True)
        if not available_years:
            return ConstructorRaceHistoryResponse(
                team_name=team.name,
                races=[],
                available_years=[],
            )

        if fetch_all:
            start_year = available_years[-1]
            end_year = available_years[0]
        else:
            if end_year is None:
                end_year = available_years[0]
            if start_year is None:
                start_year = max(end_year - 4, available_years[-1])

        # Get race results
        race_data = await ConstructorService._get_races_in_range(
            db,
            list(team_data_map.values()),
            start_year,
            end_year,
            include_sprint,
        )

        # Group by race
        races_dict = {}
        for row in race_data:
            race_key = (row.year, row.round, row.event_name)
            if race_key not in races_dict:
                races_dict[race_key] = {
                    "year": row.year,
                    "round": row.round,
                    "race_name": row.event_name,
                    "drivers": [],
                    "total_points": 0.0,
                    "best_position": None,
                }

            races_dict[race_key]["drivers"].append(
                {
                    "name": row.full_name,
                    "code": row.driver_code,
                    "slug": _make_slug(row.jolpica_id, row.full_name),
                    "position": row.position,
                    "status": row.status,
                }
            )
            if row.points is not None:
                races_dict[race_key]["total_points"] += float(row.points)

            if row.position is not None:
                if (
                    races_dict[race_key]["best_position"] is None
                    or row.position < races_dict[race_key]["best_position"]
                ):
                    races_dict[race_key]["best_position"] = row.position

        # Convert to list
        races = []
        for race_data_dict in races_dict.values():
            drivers_list = race_data_dict["drivers"]

            driver_1_name = drivers_list[0]["name"] if len(drivers_list) > 0 else None
            driver_1_code = drivers_list[0]["code"] if len(drivers_list) > 0 else None
            driver_1_slug = drivers_list[0]["slug"] if len(drivers_list) > 0 else None
            driver_1_position = (
                drivers_list[0]["position"] if len(drivers_list) > 0 else None
            )
            driver_1_status = (
                drivers_list[0]["status"] if len(drivers_list) > 0 else None
            )
            driver_2_name = drivers_list[1]["name"] if len(drivers_list) > 1 else None
            driver_2_code = drivers_list[1]["code"] if len(drivers_list) > 1 else None
            driver_2_slug = drivers_list[1]["slug"] if len(drivers_list) > 1 else None
            driver_2_position = (
                drivers_list[1]["position"] if len(drivers_list) > 1 else None
            )
            driver_2_status = (
                drivers_list[1]["status"] if len(drivers_list) > 1 else None
            )

            races.append(
                ConstructorRaceHistory(
                    year=race_data_dict["year"],
                    round=race_data_dict["round"],
                    race_name=race_data_dict["race_name"],
                    best_position=race_data_dict["best_position"],
                    total_points=race_data_dict["total_points"],
                    driver_1_name=driver_1_name,
                    driver_1_code=driver_1_code,
                    driver_1_slug=driver_1_slug,
                    driver_1_position=driver_1_position,
                    driver_1_status=driver_1_status,
                    driver_2_name=driver_2_name,
                    driver_2_code=driver_2_code,
                    driver_2_slug=driver_2_slug,
                    driver_2_position=driver_2_position,
                    driver_2_status=driver_2_status,
                )
            )

        return ConstructorRaceHistoryResponse(
            team_name=team.name,
            races=races,
            available_years=available_years,
        )

    # =========================================================================
    # Helpers
    # =========================================================================

    @staticmethod
    async def _resolve_identity(db: AsyncSession, name: str):
        """Canonical constructor plus its most recent team record, in one statement."""
        base = (
            select(
                Constructor.id.label("constructor_id"),
                Constructor.slug.label("constructor_slug"),
                Team.name.label("team_name"),
                Team.team_color.label("team_color"),
                Team.logo_url.label("logo_url"),
            )
            .join(Team, Team.constructor_id == Constructor.id)
            .order_by(Team.year.desc(), Team.id.desc())
            .limit(1)
        )
        identity = (
            await db.execute(base.where(Constructor.slug == name.lower()))
        ).first()
        if identity:
            return identity
        return (
            await db.execute(
                base.join(
                    ConstructorExternalId,
                    ConstructorExternalId.constructor_id == Constructor.id,
                ).where(
                    ConstructorExternalId.source == "legacy-name",
                    ConstructorExternalId.external_id == name.replace("-", " ").lower(),
                )
            )
        ).first()

    @staticmethod
    async def _get_team_by_name(db: AsyncSession, name: str) -> Optional[Team]:
        constructor = await db.scalar(
            select(Constructor).where(Constructor.slug == name.lower())
        )
        if not constructor:
            constructor = await db.scalar(
                select(Constructor)
                .join(ConstructorExternalId)
                .where(
                    ConstructorExternalId.source == "legacy-name",
                    ConstructorExternalId.external_id == name.replace("-", " ").lower(),
                )
            )
        if constructor:
            return await db.scalar(
                select(Team)
                .where(Team.constructor_id == constructor.id)
                .order_by(Team.year.desc())
                .limit(1)
            )
        return None

    @staticmethod
    async def _get_all_teams_info(db: AsyncSession, name: str):
        team = await ConstructorService._get_team_by_name(db, name)
        if not team:
            return []
        return (
            await db.execute(
                select(Team.id, Team.year).where(
                    Team.constructor_id == team.constructor_id
                )
            )
        ).all()

    @staticmethod
    async def _get_season_aggregated_results(db: AsyncSession, team_ids: List[int]):
        query = (
            select(
                Session.year,
                func.sum(SessionResult.points).label("total_points"),
                func.count(Session.id.distinct()).label("race_count"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(SessionResult.team_id.in_(team_ids))
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Session.year)
            .order_by(Session.year)
        )
        result = await db.execute(query)
        return result.all()

    @staticmethod
    async def _get_races_in_range(
        db: AsyncSession,
        team_ids: List[int],
        start_year: int,
        end_year: int,
        include_sprint: bool = True,
    ):
        query = (
            select(
                Session.year,
                Session.round,
                Session.event_name,
                Session.date,
                SessionResult.position,
                SessionResult.points,
                SessionResult.status,
                Driver.full_name,
                Driver.driver_code,
                Driver.jolpica_id,
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .where(SessionResult.team_id.in_(team_ids))
            .where(
                Session.session_type.in_(
                    ConstructorService._session_types(include_sprint)
                )
            )
            .where(Session.year >= start_year)
            .where(Session.year <= end_year)
            .order_by(Session.date, SessionResult.position)
        )
        result = await db.execute(query)
        return result.all()
