from datetime import date
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func, select
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
from app.services.results.common import _make_slug


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
        team_name_normalized = team_name

        team = await ConstructorService._get_team_by_name(db, team_name_normalized)
        if not team:
            return None
        constructor_slug = await db.scalar(
            select(Constructor.slug).where(Constructor.id == team.constructor_id)
        )

        team_ids = await ConstructorService._get_all_team_ids(db, team_name_normalized)

        race_results = await ConstructorService._get_race_results_by_ids(
            db, team_ids, include_sprint
        )

        if not race_results:
            return ConstructorProfileResponse(
                team_name=team.name,
                constructor_slug=constructor_slug,
                team_color=team.team_color,
                total_seasons=0,
                total_races=0,
                total_championships=0,
                total_wins=0,
                total_podiums=0,
                total_points=0.0,
                best_finish=None,
                latest_season=None,
            )

        # Calculate statistics
        seasons = set()
        races_set = set()  # Group by race key
        total_wins = 0
        total_podiums = 0
        total_points = 0.0
        best_finish = None

        for result, session in race_results:
            seasons.add(session.year)
            race_key = (session.year, session.round, session.session_type)
            races_set.add(race_key)

            if result.position == 1:
                total_wins += 1

            if result.position in [1, 2, 3]:
                total_podiums += 1

            if result.position is not None:
                if best_finish is None or result.position < best_finish:
                    best_finish = result.position

            if result.points is not None:
                total_points += result.points

        total_races = len(races_set)

        total_championships = (
            await db.scalar(
                select(func.count())
                .select_from(ConstructorChampionshipStanding)
                .where(
                    ConstructorChampionshipStanding.team_id.in_(team_ids),
                    ConstructorChampionshipStanding.position == 1,
                    ConstructorChampionshipStanding.is_final.is_(True),
                )
            )
            or 0
        )

        latest_season = max(seasons) if seasons else None

        return ConstructorProfileResponse(
            team_name=team.name,
            constructor_slug=constructor_slug,
            team_color=team.team_color,
            logo_url=team.logo_url,
            total_seasons=len(seasons),
            total_races=total_races,
            total_championships=total_championships,
            total_wins=total_wins,
            total_podiums=total_podiums,
            total_points=total_points,
            best_finish=best_finish,
            latest_season=latest_season,
        )

    @staticmethod
    async def get_season_history(
        db: AsyncSession, team_name: str
    ) -> Optional[ConstructorSeasonHistoryResponse]:
        """
        Get constructor's championship position and points for each season.
        """
        team_name_normalized = team_name
        team = await ConstructorService._get_team_by_name(db, team_name_normalized)
        if not team:
            return None
        constructor_slug = await db.scalar(
            select(Constructor.slug).where(Constructor.id == team.constructor_id)
        )

        # Get team mapping (year -> (id, color))
        team_data_map = await ConstructorService._get_team_id_map(
            db, team_name_normalized
        )
        team_ids = [tid for tid, _ in team_data_map.values()]

        # Get aggregated results
        season_data = await ConstructorService._get_season_aggregated_results(
            db, team_ids
        )

        if not season_data:
            return ConstructorSeasonHistoryResponse(
                team_name=team.name,
                constructor_slug=constructor_slug,
                seasons=[],
            )

        years = [row.year for row in season_data]
        official = {
            row.team_id: row
            for row in (
                await db.scalars(
                    select(ConstructorChampionshipStanding).where(
                        ConstructorChampionshipStanding.team_id.in_(team_ids),
                        ConstructorChampionshipStanding.year.in_(years),
                    )
                )
            ).all()
        }
        snapshot_years = set(
            await db.scalars(
                select(ConstructorChampionshipStanding.year)
                .where(
                    ConstructorChampionshipStanding.year.in_(years),
                    ConstructorChampionshipStanding.is_final.is_(True),
                )
                .distinct()
            )
        )
        contexts = {
            row.year: row
            for row in (
                await db.scalars(
                    select(ChampionshipScoringContext).where(
                        ChampionshipScoringContext.entrant_type == "constructor",
                        ChampionshipScoringContext.year.in_(years),
                    )
                )
            ).all()
        }
        exceptions = {
            row.team_id: row
            for row in (
                await db.scalars(
                    select(ChampionshipClassificationException).where(
                        ChampionshipClassificationException.team_id.in_(team_ids),
                        ChampionshipClassificationException.year.in_(years),
                    )
                )
            ).all()
        }
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
            team_name=team.name,
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
    async def _get_all_team_ids(db: AsyncSession, name: str) -> List[int]:
        team = await ConstructorService._get_team_by_name(db, name)
        if not team:
            return []
        return list(
            await db.scalars(
                select(Team.id).where(Team.constructor_id == team.constructor_id)
            )
        )

    @staticmethod
    async def _get_team_id_map(
        db: AsyncSession, name: str
    ) -> Dict[int, Tuple[int, str]]:
        team = await ConstructorService._get_team_by_name(db, name)
        if not team:
            return {}
        rows = (
            await db.execute(
                select(Team.id, Team.year, Team.team_color).where(
                    Team.constructor_id == team.constructor_id
                )
            )
        ).all()
        return {row.year: (row.id, row.team_color) for row in rows}

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
    async def _get_race_results_by_ids(
        db: AsyncSession, team_ids: List[int], include_sprint: bool = True
    ):
        query = (
            select(SessionResult, Session)
            .join(Session, SessionResult.session_id == Session.id)
            .where(SessionResult.team_id.in_(team_ids))
            .where(
                Session.session_type.in_(
                    ConstructorService._session_types(include_sprint)
                )
            )
            .order_by(Session.date.desc())
        )
        result = await db.execute(query)
        return result.all()

    @staticmethod
    def _is_season_complete(year: int) -> bool:
        """Return True only if the season is from a prior calendar year (fully concluded)."""
        return year < date.today().year

    @staticmethod
    async def _get_season_champion_id(db: AsyncSession, year: int) -> Optional[int]:
        query = (
            select(Team.id, func.sum(SessionResult.points).label("total_points"))
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == year)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Team.id)
            .order_by(func.sum(SessionResult.points).desc())
            .limit(1)
        )
        result = await db.execute(query)
        champion = result.first()
        return champion.id if champion else None

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
    async def _get_season_standings(db: AsyncSession, year: int):
        query = (
            select(Team.id, func.sum(SessionResult.points).label("total_points"))
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == year)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Team.id)
            .order_by(func.sum(SessionResult.points).desc())
        )
        result = await db.execute(query)
        return [(row.id, row.total_points) for row in result.all()]

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
