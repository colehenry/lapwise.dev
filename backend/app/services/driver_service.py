from datetime import date
from typing import List, Optional

from sqlalchemy import case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ChampionshipClassificationException,
    ChampionshipScoringContext,
    Driver,
    DriverChampionshipStanding,
    Session,
    SessionResult,
    Team,
)
from app.schemas.driver import (
    DriverListResponse,
    DriverProfileResponse,
    DriverRaceHistoryResponse,
    DriverSeasonHistoryResponse,
    DriverSuperlativesResponse,
    RaceHistory,
    SeasonHistory,
)
from app.services.archive_aggregate_service import ArchiveAggregateService
from app.services.driver_fact_service import DriverFactService
from app.services.driver_identity_service import DriverIdentityService


class DriverService:
    """Service for driver-related operations"""

    @staticmethod
    def _session_types(include_sprint: bool) -> List[str]:
        return ["race", "sprint_race"] if include_sprint else ["race"]

    @staticmethod
    async def get_all_drivers(
        db: AsyncSession, include_sprint: bool = True
    ) -> DriverListResponse:
        """
        Get all-time driver listing with career statistics.

        Reads the rebuildable career aggregate, falling back to live
        computation when it has not been refreshed yet.
        """
        return await ArchiveAggregateService.driver_list(db, include_sprint)

    @staticmethod
    async def get_driver_profile(
        db: AsyncSession, driver_code: str, include_sprint: bool = True
    ) -> Optional[DriverProfileResponse]:
        """
        Get complete driver profile with career statistics.

        Args:
            db: Database session
            driver_code: 3-letter driver code (e.g., VER, HAM)
            include_sprint: Whether to include sprint race results in stats

        Returns:
            DriverProfileResponse with stats or None if not found
        """
        driver = await DriverService._get_driver_by_code(db, driver_code)
        if not driver:
            return None

        session_types = DriverService._session_types(include_sprint)
        stats_query = (
            select(
                func.count(SessionResult.id).label("total_races"),
                func.count(distinct(Session.year)).label("total_seasons"),
                func.sum(case((SessionResult.position == 1, 1), else_=0)).label(
                    "total_wins"
                ),
                func.sum(
                    case((SessionResult.position.in_([1, 2, 3]), 1), else_=0)
                ).label("total_podiums"),
                func.coalesce(func.sum(SessionResult.points), 0).label("total_points"),
                func.min(SessionResult.position).label("best_finish"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(SessionResult.driver_id == driver.id)
            .where(Session.session_type.in_(session_types))
        )
        stats = (await db.execute(stats_query)).first()

        if not stats or not stats.total_races:
            return DriverProfileResponse(
                driver_code=driver.driver_code,
                driver_slug=driver.driver_slug,
                full_name=driver.full_name,
                driver_number=driver.driver_number,
                country_code=driver.country_code,
                headshot_url=None,
                total_seasons=0,
                total_races=0,
                total_championships=0,
                total_wins=0,
                total_podiums=0,
                total_points=0.0,
                best_finish=None,
                current_team=None,
                current_team_color=None,
                latest_season=None,
            )

        total_championships = (
            await db.scalar(
                select(func.count())
                .select_from(DriverChampionshipStanding)
                .where(
                    DriverChampionshipStanding.driver_id == driver.id,
                    DriverChampionshipStanding.position == 1,
                    DriverChampionshipStanding.is_final.is_(True),
                )
            )
            or 0
        )

        # Most recent result — current team, headshot, latest season
        recent = (
            await db.execute(
                select(
                    Team.name, Team.team_color, SessionResult.headshot_url, Session.year
                )
                .join(Session, SessionResult.session_id == Session.id)
                .join(Team, SessionResult.team_id == Team.id)
                .where(SessionResult.driver_id == driver.id)
                .where(Session.session_type.in_(session_types))
                .order_by(Session.date.desc())
                .limit(1)
            )
        ).first()

        return DriverProfileResponse(
            driver_code=driver.driver_code,
            driver_slug=driver.driver_slug,
            full_name=driver.full_name,
            driver_number=driver.driver_number,
            country_code=driver.country_code,
            headshot_url=recent.headshot_url if recent else None,
            total_seasons=stats.total_seasons,
            total_races=stats.total_races,
            total_championships=total_championships,
            total_wins=stats.total_wins or 0,
            total_podiums=stats.total_podiums or 0,
            total_points=float(stats.total_points),
            best_finish=stats.best_finish,
            current_team=recent.name if recent else None,
            current_team_color=recent.team_color if recent else None,
            latest_season=recent.year if recent else None,
        )

    @staticmethod
    async def get_season_history(
        db: AsyncSession, driver_code: str
    ) -> Optional[DriverSeasonHistoryResponse]:
        """
        Get driver's championship position and points for each season.
        """
        driver = await DriverService._get_driver_by_code(db, driver_code)
        if not driver:
            return None

        # Get all race results grouped by season
        season_data = await DriverService._get_season_aggregated_results(db, driver.id)

        if not season_data:
            return DriverSeasonHistoryResponse(
                driver_code=driver.driver_code,
                driver_slug=driver.driver_slug,
                full_name=driver.full_name,
                seasons=[],
            )

        years = [row.year for row in season_data]

        official = {
            row.year: row
            for row in (
                await db.scalars(
                    select(DriverChampionshipStanding).where(
                        DriverChampionshipStanding.driver_id == driver.id,
                        DriverChampionshipStanding.year.in_(years),
                    )
                )
            ).all()
        }
        contexts = {
            row.year: row.explanation
            for row in (
                await db.scalars(
                    select(ChampionshipScoringContext).where(
                        ChampionshipScoringContext.entrant_type == "driver",
                        ChampionshipScoringContext.year.in_(years),
                    )
                )
            ).all()
        }
        exceptions = {
            row.year: row
            for row in (
                await db.scalars(
                    select(ChampionshipClassificationException).where(
                        ChampionshipClassificationException.driver_id == driver.id,
                        ChampionshipClassificationException.year.in_(years),
                    )
                )
            ).all()
        }
        seasons = [
            SeasonHistory(
                year=row.year,
                championship_position=(
                    None
                    if row.year in exceptions
                    else official.get(row.year).position
                    if row.year in official
                    else None
                ),
                total_points=(
                    float(official[row.year].championship_points)
                    if row.year in official
                    else 0
                    if row.year < date.today().year
                    else float(row.total_points)
                ),
                championship_points=(
                    None
                    if row.year in exceptions
                    else float(official[row.year].championship_points)
                    if row.year in official
                    else None
                    if row.year < date.today().year
                    else float(row.total_points)
                ),
                points_scored=float(row.total_points),
                classification_status=(
                    exceptions[row.year].status
                    if row.year in exceptions
                    else "classified"
                    if row.year in official and official[row.year].is_final
                    else "not_classified"
                    if row.year < date.today().year
                    else "provisional"
                ),
                scoring_explanation=(
                    exceptions[row.year].explanation
                    if row.year in exceptions
                    else contexts.get(row.year)
                    if row.year in official
                    and float(official[row.year].championship_points)
                    != float(row.total_points)
                    else None
                ),
                race_count=int(row.race_count or 0),
                team_name=row.team_name,
                team_color=row.team_color,
            )
            for row in season_data
        ]

        return DriverSeasonHistoryResponse(
            driver_code=driver.driver_code,
            driver_slug=driver.driver_slug,
            full_name=driver.full_name,
            seasons=seasons,
        )

    @staticmethod
    async def get_race_history(
        db: AsyncSession,
        driver_code: str,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
        fetch_all: bool = False,
        include_sprint: bool = True,
    ) -> Optional[DriverRaceHistoryResponse]:
        """
        Get driver's race-by-race results across their career.
        """
        driver = await DriverService._get_driver_by_code(db, driver_code)
        if not driver:
            return None

        available_years = await DriverService._get_available_years(db, driver.id)
        if not available_years:
            return DriverRaceHistoryResponse(
                driver_code=driver.driver_code,
                driver_slug=driver.driver_slug,
                full_name=driver.full_name,
                races=[],
                available_years=[],
            )

        # Determine year range
        if fetch_all:
            start_year = available_years[-1]
            end_year = available_years[0]
        else:
            if end_year is None:
                end_year = available_years[0]
            if start_year is None:
                start_year = max(end_year - 4, available_years[-1])

        # Get all race results in the year range
        race_data = await DriverService._get_races_in_range(
            db, driver.id, start_year, end_year, include_sprint
        )

        races = [
            RaceHistory(
                year=row.year,
                round=row.round,
                race_name=row.event_name,
                session_type=row.session_type,
                position=row.position,
                grid_position=row.grid_position,
                points=float(row.points) if row.points is not None else None,
                team_name=row.team_name,
                team_color=row.team_color,
                status=row.status,
                fastest_lap=bool(row.fastest_lap) if row.fastest_lap else False,
            )
            for row in race_data
        ]

        return DriverRaceHistoryResponse(
            driver_code=driver.driver_code,
            driver_slug=driver.driver_slug,
            full_name=driver.full_name,
            races=races,
            available_years=available_years,
        )

    @staticmethod
    async def get_driver_superlatives(
        db: AsyncSession, driver_code: str, include_sprint: bool = True
    ) -> Optional[DriverSuperlativesResponse]:
        return await DriverFactService.driver_page_superlatives(
            db, driver_code, include_sprint
        )

    # =========================================================================
    # Helpers
    # =========================================================================

    @staticmethod
    async def _get_driver_by_code(
        db: AsyncSession, driver_code: str
    ) -> Optional[Driver]:
        return await DriverIdentityService.resolve(db, driver_code)

    @staticmethod
    async def _get_season_aggregated_results(db: AsyncSession, driver_id: int):
        query = (
            select(
                Session.year,
                func.sum(SessionResult.points).label("total_points"),
                func.count(SessionResult.id).label("race_count"),
                func.max(Team.name).label("team_name"),  # Get most recent team
                func.max(Team.team_color).label("team_color"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.driver_id == driver_id)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Session.year)
            .order_by(Session.year)
        )
        result = await db.execute(query)
        return result.all()

    @staticmethod
    async def _get_available_years(db: AsyncSession, driver_id: int) -> List[int]:
        query = (
            select(Session.year)
            .join(SessionResult, Session.id == SessionResult.session_id)
            .where(SessionResult.driver_id == driver_id)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .distinct()
            .order_by(Session.year.desc())
        )
        result = await db.execute(query)
        return [row[0] for row in result.all()]

    @staticmethod
    async def _get_races_in_range(
        db: AsyncSession,
        driver_id: int,
        start_year: int,
        end_year: int,
        include_sprint: bool = True,
    ):
        session_types = DriverService._session_types(include_sprint)
        query = (
            select(
                Session.year,
                Session.round,
                Session.event_name,
                Session.session_type,
                SessionResult.position,
                SessionResult.grid_position,
                SessionResult.points,
                SessionResult.status,
                SessionResult.fastest_lap,
                Team.name.label("team_name"),
                Team.team_color,
                Session.date,
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.driver_id == driver_id)
            .where(Session.session_type.in_(session_types))
            .where(Session.year >= start_year)
            .where(Session.year <= end_year)
            .order_by(Session.date)
        )
        result = await db.execute(query)
        return result.all()
