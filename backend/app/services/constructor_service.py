from typing import Optional, List, Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.models import Team, SessionResult, Session, Driver
from app.schemas.constructor import (
    ConstructorProfileResponse,
    ConstructorSeasonHistoryResponse,
    ConstructorSeasonHistory,
    ConstructorRaceHistoryResponse,
    ConstructorRaceHistory,
    ConstructorListItem,
    ConstructorListResponse,
)


class ConstructorService:
    """Service for constructor-related operations"""

    @staticmethod
    async def get_all_constructors(db: AsyncSession) -> ConstructorListResponse:
        """
        Get all-time constructor listing with career statistics.

        Groups by normalized team name (case-insensitive).
        Returns constructors ordered by total wins DESC, total points DESC.
        """
        # Subquery: latest team_color and logo_url per team name
        latest_team = select(
            func.lower(Team.name).label("team_name_lower"),
            Team.team_color,
            Team.logo_url,
            func.row_number()
            .over(
                partition_by=func.lower(Team.name),
                order_by=Team.year.desc(),
            )
            .label("rn"),
        ).subquery("latest_team")
        branding = (
            select(
                latest_team.c.team_name_lower,
                latest_team.c.team_color,
                latest_team.c.logo_url,
            )
            .where(latest_team.c.rn == 1)
            .subquery("branding")
        )

        # Aggregate stats per team name (case-insensitive)
        stats = (
            select(
                func.lower(Team.name).label("team_name_lower"),
                func.max(Team.name).label("team_name"),
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
                func.min(Session.year).label("first_season"),
                func.max(Session.year).label("latest_season"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .group_by(func.lower(Team.name))
        ).subquery("stats")

        # Join stats with branding in a single query
        query = (
            select(
                stats.c.team_name,
                stats.c.total_races,
                stats.c.total_wins,
                stats.c.total_podiums,
                stats.c.total_points,
                stats.c.first_season,
                stats.c.latest_season,
                branding.c.team_color,
                branding.c.logo_url,
            )
            .outerjoin(
                branding,
                stats.c.team_name_lower == branding.c.team_name_lower,
            )
            .order_by(stats.c.total_wins.desc(), stats.c.total_points.desc())
        )

        result = await db.execute(query)
        rows = result.all()

        constructors = [
            ConstructorListItem(
                team_name=row.team_name,
                team_color=row.team_color,
                logo_url=row.logo_url,
                total_wins=int(row.total_wins or 0),
                total_races=int(row.total_races or 0),
                total_podiums=int(row.total_podiums or 0),
                total_points=float(row.total_points or 0),
                first_season=row.first_season,
                latest_season=row.latest_season,
            )
            for row in rows
        ]

        return ConstructorListResponse(
            constructors=constructors, total=len(constructors)
        )

    @staticmethod
    async def get_constructor_profile(
        db: AsyncSession, team_name: str
    ) -> Optional[ConstructorProfileResponse]:
        """
        Get complete constructor profile with career statistics.
        """
        # Normalize team name
        team_name_normalized = team_name.replace("-", " ")

        # Get team basic info
        team = await ConstructorService._get_team_by_name(db, team_name_normalized)
        if not team:
            return None

        # Get all team IDs for this name
        team_ids = await ConstructorService._get_all_team_ids(db, team_name_normalized)

        # Get all race results
        race_results = await ConstructorService._get_race_results_by_ids(db, team_ids)

        if not race_results:
            return ConstructorProfileResponse(
                team_name=team.name,
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

        # Calculate championships
        total_championships = 0
        for year in seasons:
            champion_id = await ConstructorService._get_season_champion_id(db, year)
            if champion_id and champion_id in team_ids:
                total_championships += 1

        latest_season = max(seasons) if seasons else None

        return ConstructorProfileResponse(
            team_name=team.name,
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
        team_name_normalized = team_name.replace("-", " ")
        team = await ConstructorService._get_team_by_name(db, team_name_normalized)
        if not team:
            return None

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
                seasons=[],
            )

        seasons = []
        for season_row in season_data:
            year = season_row.year

            standings = await ConstructorService._get_season_standings(db, year)

            championship_position = None
            team_id_for_year = team_data_map.get(year, (None, None))[0]

            for idx, (t_id, _) in enumerate(standings):
                if t_id == team_id_for_year:
                    championship_position = idx + 1
                    break

            seasons.append(
                ConstructorSeasonHistory(
                    year=year,
                    championship_position=championship_position,
                    total_points=float(season_row.total_points),
                    race_count=int(season_row.race_count or 0),
                    team_color=team_data_map.get(year, (None, None))[1],
                )
            )

        return ConstructorSeasonHistoryResponse(
            team_name=team.name,
            seasons=seasons,
        )

    @staticmethod
    async def get_race_history(
        db: AsyncSession,
        team_name: str,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
        fetch_all: bool = False,
    ) -> Optional[ConstructorRaceHistoryResponse]:
        """
        Get constructor's race-by-race results across their career.
        """
        team_name_normalized = team_name.replace("-", " ")
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
            db, list(team_data_map.values()), start_year, end_year
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
            driver_1_position = (
                drivers_list[0]["position"] if len(drivers_list) > 0 else None
            )
            driver_1_status = (
                drivers_list[0]["status"] if len(drivers_list) > 0 else None
            )
            driver_2_name = drivers_list[1]["name"] if len(drivers_list) > 1 else None
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
                    driver_1_position=driver_1_position,
                    driver_1_status=driver_1_status,
                    driver_2_name=driver_2_name,
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
        query = (
            select(Team)
            .where(func.lower(Team.name) == name.lower())
            .order_by(Team.year.desc())
            .limit(1)
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def _get_all_team_ids(db: AsyncSession, name: str) -> List[int]:
        query = select(Team.id).where(func.lower(Team.name) == name.lower())
        result = await db.execute(query)
        return [row[0] for row in result.all()]

    @staticmethod
    async def _get_team_id_map(
        db: AsyncSession, name: str
    ) -> Dict[int, Tuple[int, str]]:
        query = select(Team.id, Team.year, Team.team_color).where(
            func.lower(Team.name) == name.lower()
        )
        result = await db.execute(query)
        return {row.year: (row.id, row.team_color) for row in result.all()}

    @staticmethod
    async def _get_all_teams_info(db: AsyncSession, name: str):
        query = select(Team.id, Team.year).where(func.lower(Team.name) == name.lower())
        result = await db.execute(query)
        return result.all()

    @staticmethod
    async def _get_race_results_by_ids(db: AsyncSession, team_ids: List[int]):
        query = (
            select(SessionResult, Session)
            .join(Session, SessionResult.session_id == Session.id)
            .where(SessionResult.team_id.in_(team_ids))
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .order_by(Session.date.desc())
        )
        result = await db.execute(query)
        return result.all()

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
        db: AsyncSession, team_ids: List[int], start_year: int, end_year: int
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
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .where(SessionResult.team_id.in_(team_ids))
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(Session.year >= start_year)
            .where(Session.year <= end_year)
            .order_by(Session.date, SessionResult.position)
        )
        result = await db.execute(query)
        return result.all()
