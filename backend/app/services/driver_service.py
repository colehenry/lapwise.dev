from datetime import date
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.models import Driver, SessionResult, Session, Team
from app.schemas.driver import (
    DriverProfileResponse,
    DriverSeasonHistoryResponse,
    SeasonHistory,
    DriverRaceHistoryResponse,
    RaceHistory,
    DriverListItem,
    DriverListResponse,
)


class DriverService:
    """Service for driver-related operations"""

    @staticmethod
    async def get_all_drivers(db: AsyncSession) -> DriverListResponse:
        """
        Get all-time driver listing with career statistics.

        Returns all drivers ordered by total wins DESC, total points DESC.
        """
        # Subquery: get the most recent session date per driver (for headshot + latest_season)
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

        # Subquery: get headshot and latest_season from most recent race
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

        # Subquery: count distinct seasons per driver+team
        team_seasons_sq = (
            select(
                SessionResult.driver_id,
                SessionResult.team_id,
                func.count(func.distinct(Session.year)).label("season_count"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .group_by(SessionResult.driver_id, SessionResult.team_id)
            .subquery()
        )

        # Subquery: max season count per driver
        max_team_seasons_sq = (
            select(
                team_seasons_sq.c.driver_id,
                func.max(team_seasons_sq.c.season_count).label("max_seasons"),
            )
            .group_by(team_seasons_sq.c.driver_id)
            .subquery()
        )

        # Subquery: get the team with the most seasons (tie-break by team_id desc for most recent)
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

        # Main query: aggregate stats per driver
        query = (
            select(
                Driver.id,
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
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .group_by(
                Driver.id,
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
            )
        )

        result = await db.execute(query)
        rows = result.all()

        from app.services.results_service import _make_slug

        drivers = [
            DriverListItem(
                driver_code=row.driver_code,
                driver_slug=_make_slug(row.jolpica_id, row.full_name),
                full_name=row.full_name,
                country_code=row.country_code,
                headshot_url=row.headshot_url,
                total_wins=int(row.total_wins or 0),
                total_races=int(row.total_races or 0),
                total_podiums=int(row.total_podiums or 0),
                total_points=float(row.total_points or 0),
                current_team=row.current_team,
                current_team_color=row.current_team_color,
                first_season=row.first_season,
                latest_season=row.latest_season,
            )
            for row in rows
        ]

        return DriverListResponse(drivers=drivers, total=len(drivers))

    @staticmethod
    async def get_driver_profile(
        db: AsyncSession, driver_code: str
    ) -> Optional[DriverProfileResponse]:
        """
        Get complete driver profile with career statistics.

        Args:
            db: Database session
            driver_code: 3-letter driver code (e.g., VER, HAM)

        Returns:
            DriverProfileResponse with stats or None if not found
        """
        # Get driver basic info
        driver = await DriverService._get_driver_by_code(db, driver_code)
        if not driver:
            return None

        # Get all race results (not qualifying or practice)
        results = await DriverService._get_all_race_results(db, driver.id)

        if not results:
            # Driver exists but has no race results yet
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

        # Calculate statistics
        seasons = set()
        total_races = 0
        total_wins = 0
        total_podiums = 0
        total_points = 0.0
        best_finish = None

        for result, session, team in results:
            seasons.add(session.year)
            total_races += 1

            # Count wins (position 1)
            if result.position == 1:
                total_wins += 1

            # Count podiums (positions 1, 2, 3)
            if result.position in [1, 2, 3]:
                total_podiums += 1

            # Track best finish
            if result.position is not None:
                if best_finish is None or result.position < best_finish:
                    best_finish = result.position

            # Sum points
            if result.points is not None:
                total_points += result.points

        # Calculate championships — only count completed seasons
        total_championships = 0
        for year in seasons:
            if not DriverService._is_season_complete(year):
                continue
            champion_id = await DriverService._get_season_champion_id(db, year)
            if champion_id and champion_id == driver.id:
                total_championships += 1

        # Get current team and headshot (from most recent race)
        most_recent = results[0]  # Already ordered by date desc
        current_team_name = most_recent.Team.name
        current_team_color = most_recent.Team.team_color
        latest_season = most_recent.Session.year
        headshot_url = most_recent.SessionResult.headshot_url

        return DriverProfileResponse(
            driver_code=driver.driver_code,
            driver_slug=driver.driver_slug,
            full_name=driver.full_name,
            driver_number=driver.driver_number,
            country_code=driver.country_code,
            headshot_url=headshot_url,
            total_seasons=len(seasons),
            total_races=total_races,
            total_championships=total_championships,
            total_wins=total_wins,
            total_podiums=total_podiums,
            total_points=total_points,
            best_finish=best_finish,
            current_team=current_team_name,
            current_team_color=current_team_color,
            latest_season=latest_season,
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

        seasons = []
        for season_row in season_data:
            year = season_row.year

            # Find driver's position in that year's standing
            standings = await DriverService._get_season_standings(db, year)

            championship_position = None
            for idx, (d_id, points) in enumerate(standings):
                if d_id == driver.id:
                    championship_position = idx + 1
                    break

            seasons.append(
                SeasonHistory(
                    year=year,
                    championship_position=championship_position,
                    total_points=float(season_row.total_points),
                    race_count=int(season_row.race_count or 0),
                    team_name=season_row.team_name,
                    team_color=season_row.team_color,
                )
            )

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
            db, driver.id, start_year, end_year
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

    # =========================================================================
    # Helpers
    # =========================================================================

    @staticmethod
    async def _get_driver_by_code(
        db: AsyncSession, driver_code: str
    ) -> Optional[Driver]:
        # Try jolpica_id first (slug format: "max-verstappen" -> "max_verstappen")
        jolpica_id = driver_code.replace("-", "_")
        query = select(Driver).where(Driver.jolpica_id == jolpica_id)
        result = await db.execute(query)
        driver = result.scalar_one_or_none()
        if driver:
            return driver

        # Try exact driver_code match (VER, HAM, etc.)
        query = select(Driver).where(Driver.driver_code == driver_code.upper())
        result = await db.execute(query)
        driver = result.scalar_one_or_none()
        if driver:
            return driver

        # Fallback: treat as a name slug (e.g. "juan-manuel-fangio")
        name_from_slug = driver_code.replace("-", " ")
        query = select(Driver).where(
            func.lower(Driver.full_name) == name_from_slug.lower()
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def _get_all_race_results(db: AsyncSession, driver_id: int):
        query = (
            select(SessionResult, Session, Team)
            .join(Session, SessionResult.session_id == Session.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.driver_id == driver_id)
            .where(Session.session_type.in_(["race", "sprint_race"]))
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
        standings_query = (
            select(Driver.id, func.sum(SessionResult.points).label("total_points"))
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == year)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Driver.id)
            .order_by(func.sum(SessionResult.points).desc())
            .limit(1)
        )
        result = await db.execute(standings_query)
        champion = result.first()
        return champion.id if champion else None

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
    async def _get_season_standings(
        db: AsyncSession, year: int
    ) -> List[Tuple[int, float]]:
        query = (
            select(Driver.id, func.sum(SessionResult.points).label("total_points"))
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == year)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Driver.id)
            .order_by(func.sum(SessionResult.points).desc())
        )
        result = await db.execute(query)
        return [(row.id, row.total_points) for row in result.all()]

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
        db: AsyncSession, driver_id: int, start_year: int, end_year: int
    ):
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
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(Session.year >= start_year)
            .where(Session.year <= end_year)
            .order_by(Session.date)
        )
        result = await db.execute(query)
        return result.all()
