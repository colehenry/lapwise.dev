"""
Results Service

Business logic for fetching and processing season results data.
Extracted from season_results.py router for better separation of concerns.
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from sqlalchemy.orm import selectinload
import math

from app.models import (
    Session,
    SessionResult,
    Driver,
    Team,
    Circuit,
    Lap,
    TrackStatus,
    Weather,
    RaceControlMessage,
)
from app.schemas.result import (
    StandingsResponse,
    DriverStanding,
    ConstructorStanding,
    DriverProgressionData,
    ConstructorProgressionData,
    PointsProgressionRound,
    PointsProgressionResponse,
    SeasonRoundsResponse,
    RoundSummary,
    RoundPodiumDriver,
    LapData,
    DriverLapTimesData,
    LapTimesResponse,
    TrackStatusEvent,
    RaceControlEvent,
    SessionResultsResponse,
    SessionInfo,
    CircuitInfo,
    SessionResultDetail,
    DriverInfo,
    TeamInfo,
    QualifyingStandingsResponse,
    DriverQualifyingStanding,
    ConstructorQualifyingStanding,
    QualifyingSectorComparison,
    QualifyingSectorResponse,
    WeatherDataPoint,
    WeatherResponse,
    DistributionLap,
    DriverLapDistribution,
    LapDistributionResponse,
)


def _make_slug(jolpica_id: Optional[str], full_name: str) -> str:
    """Compute URL-safe driver slug from jolpica_id or full_name."""
    if jolpica_id:
        return jolpica_id.replace("_", "-")
    return full_name.lower().replace(" ", "-")


class ResultsService:
    """Service class for results-related operations"""

    @staticmethod
    def _latest_headshot_subquery():
        """
        Correlated subquery to fetch the latest valid headshot URL for a driver.
        """
        return (
            select(SessionResult.headshot_url)
            .join(Session, SessionResult.session_id == Session.id)
            .where(SessionResult.driver_id == Driver.id)
            .where(SessionResult.headshot_url.isnot(None))
            .where(SessionResult.headshot_url != "None")
            .where(SessionResult.headshot_url != "nan")
            .where(SessionResult.headshot_url != "")
            .order_by(Session.date.desc(), Session.round.desc())
            .limit(1)
            .scalar_subquery()
        )

    @staticmethod
    def _headshot_fallback_expr():
        """
        Prefer the session headshot if valid, otherwise fall back to latest.
        """
        cleaned = func.nullif(
            func.nullif(func.nullif(SessionResult.headshot_url, "None"), "nan"), ""
        )
        return func.coalesce(cleaned, ResultsService._latest_headshot_subquery())

    @staticmethod
    def sanitize_float(value: Optional[float]) -> Optional[float]:
        """Convert inf/nan float values to None for JSON serialization"""
        if value is None:
            return None
        if math.isnan(value) or math.isinf(value):
            return None
        return value

    @staticmethod
    async def get_available_seasons(db: AsyncSession) -> List[int]:
        """
        Get all available seasons/years that have session data.
        """
        query = select(Session.year).distinct().order_by(Session.year.desc())
        result = await db.execute(query)
        seasons = [row[0] for row in result.all()]
        return seasons

    @staticmethod
    async def get_latest_race_session(db: AsyncSession) -> Optional[Session]:
        """
        Get the most recent race session.
        """
        query = (
            select(Session)
            .where(Session.session_type == "race")
            .order_by(Session.date.desc())
            .limit(1)
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_podium_results(db: AsyncSession, session_id: int):
        """
        Get top 3 finishers for a given session.
        """
        query = (
            select(
                Session.round,
                Session.event_name,
                Session.date,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                Circuit.id.label("circuit_id"),
                Circuit.location.label("circuit_location"),
                Circuit.country.label("circuit_country"),
                SessionResult.position,
                Driver.full_name,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.country_code,
                ResultsService._headshot_fallback_expr().label("headshot_url"),
                Team.name.label("team_name"),
                Team.team_color,
                Team.logo_url,
                SessionResult.fastest_lap,
                SessionResult.time_seconds,
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.id == session_id)
            .where(SessionResult.position.between(1, 3))
            .order_by(SessionResult.position)
        )

        result = await db.execute(query)
        return result.all()

    @staticmethod
    async def get_season_standings(
        db: AsyncSession, season: int
    ) -> Optional[StandingsResponse]:
        """
        Get driver and constructor championship standings for a season.
        """
        # Check if season exists
        season_check = await db.execute(
            select(Session.id).where(Session.year == season).limit(1)
        )
        if not season_check.first():
            return None

        # ====================================================================
        # Driver Standings Query
        # ====================================================================
        # First, get total points per driver
        points_subquery = (
            select(
                Driver.id.label("driver_id"),
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                func.sum(SessionResult.points).label("total_points"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(SessionResult.points.isnot(None))
            .group_by(
                Driver.id,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
            )
            .subquery()
        )

        # Then, for each driver, get their most recent session
        latest_results = {}
        distinct_drivers = await db.execute(
            select(Driver.id)
            .distinct()
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
        )

        for driver_row in distinct_drivers:
            driver_id = driver_row[0]
            # Get the most recent session_result for this driver
            latest_result_query = (
                select(
                    SessionResult,
                    Team,
                    ResultsService._headshot_fallback_expr().label("headshot_url"),
                )
                .join(Session, SessionResult.session_id == Session.id)
                .join(Team, SessionResult.team_id == Team.id)
                .where(SessionResult.driver_id == driver_id)
                .where(Session.year == season)
                .order_by(Session.date.desc(), Session.round.desc())
                .limit(1)
            )
            result = await db.execute(latest_result_query)
            row = result.first()
            if row:
                latest_results[driver_id] = row

        # Build driver standings by combining points with latest team info
        driver_standings_data = []
        standings_result = await db.execute(
            select(points_subquery).order_by(points_subquery.c.total_points.desc())
        )

        for driver_row in standings_result:
            driver_id = driver_row.driver_id
            if driver_id in latest_results:
                session_result, team, headshot_url = latest_results[driver_id]
                driver_standings_data.append(
                    {
                        "driver_code": driver_row.driver_code,
                        "driver_slug": _make_slug(
                            driver_row.jolpica_id, driver_row.full_name
                        ),
                        "full_name": driver_row.full_name,
                        "country_code": driver_row.country_code,
                        "total_points": driver_row.total_points,
                        "team_name": team.name,
                        "team_color": team.team_color,
                        "headshot_url": headshot_url,
                    }
                )

        if not driver_standings_data:
            return None

        # Build driver standings with position
        drivers = [
            DriverStanding(
                position=idx + 1,
                driver_code=row["driver_code"],
                driver_slug=row["driver_slug"],
                full_name=row["full_name"],
                country_code=row["country_code"],
                team_name=row["team_name"],
                team_color=row["team_color"],
                total_points=float(row["total_points"]),
                headshot_url=row["headshot_url"],
            )
            for idx, row in enumerate(driver_standings_data)
        ]

        # ========================================================================
        # Constructor Standings Query
        # ========================================================================
        # sum points grouped by team
        constructor_query = (
            select(
                Team.name.label("team_name"),
                Team.team_color,
                Team.logo_url,
                func.sum(SessionResult.points).label("total_points"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(SessionResult.points.isnot(None))
            .group_by(Team.id, Team.name, Team.team_color, Team.logo_url)
            .order_by(func.sum(SessionResult.points).desc())
        )

        constructor_result = await db.execute(constructor_query)
        constructor_rows = constructor_result.all()

        constructors = [
            ConstructorStanding(
                position=idx + 1,
                team_name=row.team_name,
                team_color=row.team_color,
                logo_url=row.logo_url,
                total_points=float(row.total_points),
            )
            for idx, row in enumerate(constructor_rows)
        ]

        return StandingsResponse(
            year=season, drivers=drivers, constructors=constructors
        )

    @staticmethod
    async def get_qualifying_standings(
        db: AsyncSession, season: int
    ) -> Optional[QualifyingStandingsResponse]:
        """
        Get driver and constructor qualifying standings for a season.
        Calculates qualifying points: P1=20, P2=19, ..., P20=1.
        """
        # Check if season exists
        season_check = await db.execute(
            select(Session.id).where(Session.year == season).limit(1)
        )
        if not season_check.first():
            return None

        # ====================================================================
        # Driver Qualifying Standings Query
        # ====================================================================
        # Points: 21 - position (clamped to min 0)
        # Session types: qualifying, sprint_qualifying
        points_subquery = (
            select(
                Driver.id.label("driver_id"),
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                func.sum(
                    case(
                        (SessionResult.position <= 20, 21 - SessionResult.position),
                        else_=0,
                    )
                ).label("total_points"),
                func.sum(case((SessionResult.position == 1, 1), else_=0)).label(
                    "poles"
                ),
                func.sum(case((SessionResult.position == 2, 1), else_=0)).label("p2s"),
                func.sum(case((SessionResult.position == 3, 1), else_=0)).label("p3s"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .where(SessionResult.position.isnot(None))
            .group_by(
                Driver.id,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
            )
            .subquery()
        )

        # Get latest results for team/headshot
        latest_results = {}
        distinct_drivers = await db.execute(
            select(Driver.id)
            .distinct()
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
        )

        for driver_row in distinct_drivers:
            driver_id = driver_row[0]
            latest_result_query = (
                select(
                    SessionResult,
                    Team,
                    ResultsService._headshot_fallback_expr().label("headshot_url"),
                )
                .join(Session, SessionResult.session_id == Session.id)
                .join(Team, SessionResult.team_id == Team.id)
                .where(SessionResult.driver_id == driver_id)
                .where(Session.year == season)
                .order_by(Session.date.desc(), Session.round.desc())
                .limit(1)
            )
            result = await db.execute(latest_result_query)
            row = result.first()
            if row:
                latest_results[driver_id] = row

        # Build driver standings
        driver_standings_data = []
        standings_result = await db.execute(
            select(points_subquery).order_by(points_subquery.c.total_points.desc())
        )

        for driver_row in standings_result:
            driver_id = driver_row.driver_id
            if driver_id in latest_results:
                session_result, team, headshot_url = latest_results[driver_id]
                driver_standings_data.append(
                    {
                        "driver_code": driver_row.driver_code,
                        "driver_slug": _make_slug(
                            driver_row.jolpica_id, driver_row.full_name
                        ),
                        "full_name": driver_row.full_name,
                        "country_code": driver_row.country_code,
                        "total_qualifying_points": float(driver_row.total_points),
                        "team_name": team.name,
                        "team_color": team.team_color,
                        "headshot_url": headshot_url,
                        "poles": int(driver_row.poles),
                        "p2s": int(driver_row.p2s),
                        "p3s": int(driver_row.p3s),
                    }
                )

        drivers = [
            DriverQualifyingStanding(position=idx + 1, **row)
            for idx, row in enumerate(driver_standings_data)
        ]

        # ========================================================================
        # Constructor Qualifying Standings Query
        # ========================================================================
        constructor_query = (
            select(
                Team.name.label("team_name"),
                Team.team_color,
                Team.logo_url,
                func.sum(
                    case(
                        (SessionResult.position <= 20, 21 - SessionResult.position),
                        else_=0,
                    )
                ).label("total_points"),
                func.sum(case((SessionResult.position == 1, 1), else_=0)).label(
                    "poles"
                ),
                func.sum(case((SessionResult.position == 2, 1), else_=0)).label("p2s"),
                func.sum(case((SessionResult.position == 3, 1), else_=0)).label("p3s"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .where(SessionResult.position.isnot(None))
            .group_by(Team.id, Team.name, Team.team_color, Team.logo_url)
            .order_by(
                func.sum(
                    case(
                        (SessionResult.position <= 20, 21 - SessionResult.position),
                        else_=0,
                    )
                ).desc()
            )
        )

        constructor_result = await db.execute(constructor_query)
        constructor_rows = constructor_result.all()

        constructors = [
            ConstructorQualifyingStanding(
                position=idx + 1,
                team_name=row.team_name,
                team_color=row.team_color,
                logo_url=row.logo_url,
                total_qualifying_points=float(row.total_points),
                poles=int(row.poles),
                p2s=int(row.p2s),
                p3s=int(row.p3s),
            )
            for idx, row in enumerate(constructor_rows)
        ]

        return QualifyingStandingsResponse(
            year=season, drivers=drivers, constructors=constructors
        )

    @staticmethod
    async def get_points_progression(
        db: AsyncSession, season: int, mode: str, points_type: str = "race"
    ) -> Optional[PointsProgressionResponse]:
        """
        Get cumulative points progression throughout a season.
        points_type can be 'race' or 'qualifying'.
        """
        if points_type == "qualifying":
            if mode == "drivers":
                return await ResultsService._get_driver_qualifying_progression(
                    db, season
                )
            else:
                return await ResultsService._get_constructor_qualifying_progression(
                    db, season
                )

        if mode == "drivers":
            return await ResultsService._get_driver_progression(db, season)
        else:
            return await ResultsService._get_constructor_progression(db, season)

    @staticmethod
    async def _get_driver_qualifying_progression(
        db: AsyncSession, season: int
    ) -> Optional[PointsProgressionResponse]:
        # Points: 21 - position (clamped to min 0) for final position sorting
        qualifying_points = case(
            (SessionResult.position <= 20, 21 - SessionResult.position),
            else_=0,
        )

        query = (
            select(
                Driver.id.label("driver_id"),
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Team.name.label("team_name"),
                Team.team_color,
                Session.round,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                SessionResult.position,
                func.sum(qualifying_points)
                .over(
                    partition_by=Driver.id,
                    order_by=(Session.round, Session.session_type.desc()),
                )
                .label("cumulative_points"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .distinct(
                Driver.id,
                Session.round,
                Session.session_type,
                Team.team_color,
                Circuit.name,
            )
            .order_by(Driver.id, Session.round, Session.session_type.desc())
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # Get all qualifying sessions
        sessions_query = (
            select(Session.round, Session.event_name, Session.session_type)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .order_by(Session.round, Session.session_type.desc())
        )
        sessions_result = await db.execute(sessions_query)
        all_sessions = [
            (row.round, row.event_name, row.session_type)
            for row in sessions_result.all()
        ]

        drivers_dict = {}
        for row in rows:
            key = row.driver_id
            if key not in drivers_dict:
                drivers_dict[key] = {
                    "driver_code": row.driver_code or row.full_name,
                    "driver_slug": _make_slug(row.jolpica_id, row.full_name),
                    "full_name": row.full_name,
                    "team_name": row.team_name,
                    "team_color": row.team_color,
                    "sessions_data": {},
                    "final_score": 0.0,
                }
            if row.round not in drivers_dict[key]["sessions_data"]:
                drivers_dict[key]["sessions_data"][row.round] = {}
            drivers_dict[key]["sessions_data"][row.round][row.session_type] = {
                "cumulative_points": float(row.cumulative_points),
                "position": int(row.position) if row.position else None,
            }
            drivers_dict[key]["final_score"] = max(
                drivers_dict[key]["final_score"], float(row.cumulative_points)
            )

        # Build progression
        for driver_data in drivers_dict.values():
            progression = [
                PointsProgressionRound(
                    round="0", cumulative_points=0.0, position=None, event_name=None
                )
            ]

            for round_num, event_name, session_type in all_sessions:
                round_data = (
                    driver_data["sessions_data"].get(round_num, {}).get(session_type)
                )

                round_id = (
                    f"{round_num}-sq"
                    if session_type == "sprint_qualifying"
                    else str(round_num)
                )

                progression.append(
                    PointsProgressionRound(
                        round=round_id,
                        cumulative_points=round_data["cumulative_points"]
                        if round_data
                        else 0.0,
                        position=round_data["position"] if round_data else None,
                        event_name=event_name,
                    )
                )

            driver_data["progression"] = progression
            del driver_data["sessions_data"]
            del driver_data["final_score"]

        # Sort
        sorted_drivers = sorted(
            drivers_dict.values(),
            key=lambda d: d["progression"][-1].cumulative_points,
            reverse=True,
        )
        for idx, driver_data in enumerate(sorted_drivers):
            driver_data["final_position"] = idx + 1

        drivers = [DriverProgressionData(**data) for data in drivers_dict.values()]

        return PointsProgressionResponse(
            year=season, type="drivers", drivers=drivers, constructors=None
        )

    @staticmethod
    async def _get_constructor_qualifying_progression(
        db: AsyncSession, season: int
    ) -> Optional[PointsProgressionResponse]:
        qualifying_points = case(
            (SessionResult.position <= 20, 21 - SessionResult.position),
            else_=0,
        )

        query = (
            select(
                Team.name.label("team_name"),
                Team.team_color,
                Session.round,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                SessionResult.position,
                func.sum(qualifying_points)
                .over(
                    partition_by=Team.id,
                    order_by=(Session.round, Session.session_type.desc()),
                )
                .label("cumulative_points"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .order_by(Team.id, Session.round, Session.session_type.desc())
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # Get all qualifying sessions
        sessions_query = (
            select(Session.round, Session.event_name, Session.session_type)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .order_by(Session.round, Session.session_type.desc())
        )
        sessions_result = await db.execute(sessions_query)
        all_sessions = [
            (row.round, row.event_name, row.session_type)
            for row in sessions_result.all()
        ]

        teams_dict = {}
        for row in rows:
            key = row.team_name
            if key not in teams_dict:
                teams_dict[key] = {
                    "team_name": row.team_name,
                    "team_color": row.team_color,
                    "sessions_data": {},
                }
            if row.round not in teams_dict[key]["sessions_data"]:
                teams_dict[key]["sessions_data"][row.round] = {}
            if row.session_type not in teams_dict[key]["sessions_data"][row.round]:
                teams_dict[key]["sessions_data"][row.round][row.session_type] = {
                    "cumulative_points": float(row.cumulative_points),
                    "positions": [],
                }
            if row.position:
                teams_dict[key]["sessions_data"][row.round][row.session_type][
                    "positions"
                ].append(int(row.position))

        for team_data in teams_dict.values():
            progression = [
                PointsProgressionRound(
                    round="0", cumulative_points=0.0, event_name=None
                )
            ]
            all_positions = [[]]  # Round 0

            for round_num, event_name, session_type in all_sessions:
                round_data = (
                    team_data["sessions_data"].get(round_num, {}).get(session_type)
                )

                round_id = (
                    f"{round_num}-sq"
                    if session_type == "sprint_qualifying"
                    else str(round_num)
                )

                progression.append(
                    PointsProgressionRound(
                        round=round_id,
                        cumulative_points=round_data["cumulative_points"]
                        if round_data
                        else 0.0,
                        event_name=event_name,
                    )
                )
                all_positions.append(round_data["positions"] if round_data else [])

            team_data["progression"] = progression
            team_data["all_positions"] = all_positions
            del team_data["sessions_data"]

        sorted_teams = sorted(
            teams_dict.values(),
            key=lambda t: t["progression"][-1].cumulative_points,
            reverse=True,
        )
        for idx, team_data in enumerate(sorted_teams):
            team_data["final_position"] = idx + 1

        constructors = [
            ConstructorProgressionData(**data) for data in teams_dict.values()
        ]

        return PointsProgressionResponse(
            year=season, type="constructors", drivers=None, constructors=constructors
        )

    @staticmethod
    async def _get_driver_progression(
        db: AsyncSession, season: int
    ) -> Optional[PointsProgressionResponse]:
        query = (
            select(
                Driver.id.label("driver_id"),
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Team.team_color,
                Session.round,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                func.sum(func.coalesce(SessionResult.points, 0))
                .over(
                    partition_by=Driver.id,
                    order_by=(
                        Session.round,
                        Session.session_type.desc(),
                    ),  # sprint_race before race
                )
                .label("cumulative_points"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .distinct(
                Driver.id,
                Session.round,
                Session.session_type,
                Team.team_color,
                Circuit.name,
            )
            .order_by(Driver.id, Session.round, Session.session_type.desc())
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # Get all sessions
        sessions_query = (
            select(Session.round, Session.event_name, Session.session_type)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .order_by(Session.round, Session.session_type.desc())
        )
        sessions_result = await db.execute(sessions_query)
        all_sessions = [
            (row.round, row.event_name, row.session_type)
            for row in sessions_result.all()
        ]

        # Group by driver ID (integer PK) — driver_code may be NULL for pre-2003 drivers
        drivers_dict = {}
        for row in rows:
            key = row.driver_id
            if key not in drivers_dict:
                drivers_dict[key] = {
                    "driver_code": row.driver_code or row.full_name,
                    "driver_slug": _make_slug(row.jolpica_id, row.full_name),
                    "full_name": row.full_name,
                    "team_color": row.team_color,
                    "sessions_data": {},
                }
            if row.round not in drivers_dict[key]["sessions_data"]:
                drivers_dict[key]["sessions_data"][row.round] = {}
            drivers_dict[key]["sessions_data"][row.round][row.session_type] = float(
                row.cumulative_points
            )

        # Build progression
        for driver_data in drivers_dict.values():
            progression = [
                PointsProgressionRound(
                    round="0", cumulative_points=0.0, event_name=None
                )
            ]
            last_points = 0.0

            for round_num, event_name, session_type in all_sessions:
                round_data = driver_data["sessions_data"].get(round_num, {})

                if session_type in round_data:
                    last_points = round_data[session_type]

                round_id = (
                    f"{round_num}-sprint"
                    if session_type == "sprint_race"
                    else str(round_num)
                )

                progression.append(
                    PointsProgressionRound(
                        round=round_id,
                        cumulative_points=last_points,
                        event_name=event_name,
                    )
                )

            driver_data["progression"] = progression
            del driver_data["sessions_data"]

        # Sort
        sorted_drivers = sorted(
            drivers_dict.values(),
            key=lambda d: d["progression"][-1].cumulative_points,
            reverse=True,
        )
        for idx, driver_data in enumerate(sorted_drivers):
            driver_data["final_position"] = idx + 1

        drivers = [DriverProgressionData(**data) for data in drivers_dict.values()]

        return PointsProgressionResponse(
            year=season, type="drivers", drivers=drivers, constructors=None
        )

    @staticmethod
    async def _get_constructor_progression(
        db: AsyncSession, season: int
    ) -> Optional[PointsProgressionResponse]:
        query = (
            select(
                Team.name.label("team_name"),
                Team.team_color,
                Session.round,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                func.sum(func.coalesce(SessionResult.points, 0))
                .over(
                    partition_by=Team.id,
                    order_by=(Session.round, Session.session_type.desc()),
                )
                .label("cumulative_points"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .distinct(Team.id, Session.round, Session.session_type, Circuit.name)
            .order_by(Team.id, Session.round, Session.session_type.desc())
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # Get all sessions
        sessions_query = (
            select(Session.round, Session.event_name, Session.session_type)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .order_by(Session.round, Session.session_type.desc())
        )
        sessions_result = await db.execute(sessions_query)
        all_sessions = [
            (row.round, row.event_name, row.session_type)
            for row in sessions_result.all()
        ]

        teams_dict = {}
        for row in rows:
            key = row.team_name
            if key not in teams_dict:
                teams_dict[key] = {
                    "team_name": row.team_name,
                    "team_color": row.team_color,
                    "sessions_data": {},
                }
            if row.round not in teams_dict[key]["sessions_data"]:
                teams_dict[key]["sessions_data"][row.round] = {}
            teams_dict[key]["sessions_data"][row.round][row.session_type] = float(
                row.cumulative_points
            )

        for team_data in teams_dict.values():
            progression = [
                PointsProgressionRound(
                    round="0", cumulative_points=0.0, event_name=None
                )
            ]
            last_points = 0.0

            for round_num, event_name, session_type in all_sessions:
                round_data = team_data["sessions_data"].get(round_num, {})

                if session_type in round_data:
                    last_points = round_data[session_type]

                round_id = (
                    f"{round_num}-sprint"
                    if session_type == "sprint_race"
                    else str(round_num)
                )

                progression.append(
                    PointsProgressionRound(
                        round=round_id,
                        cumulative_points=last_points,
                        event_name=event_name,
                    )
                )

            team_data["progression"] = progression
            del team_data["sessions_data"]

        sorted_teams = sorted(
            teams_dict.values(),
            key=lambda t: t["progression"][-1].cumulative_points,
            reverse=True,
        )
        for idx, team_data in enumerate(sorted_teams):
            team_data["final_position"] = idx + 1

        constructors = [
            ConstructorProgressionData(**data) for data in teams_dict.values()
        ]

        return PointsProgressionResponse(
            year=season, type="constructors", drivers=None, constructors=constructors
        )

    @staticmethod
    async def get_season_rounds(
        db: AsyncSession, season: int
    ) -> Optional[SeasonRoundsResponse]:
        """
        Get all rounds for a season with top 3 finishers for each.
        """
        query = (
            select(
                Session.round,
                Session.event_name,
                Session.date,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                Circuit.id.label("circuit_id"),
                Circuit.track_length_km,
                SessionResult.position,
                Driver.full_name,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.country_code,
                ResultsService._headshot_fallback_expr().label("headshot_url"),
                Team.name.label("team_name"),
                Team.team_color,
                Team.logo_url,
                SessionResult.fastest_lap,
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.position.between(1, 3))
            .order_by(
                Session.round,
                Session.date,
                SessionResult.position,
            )
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        rounds_dict = {}
        for row in rows:
            key = (row.round, row.session_type)
            if key not in rounds_dict:
                rounds_dict[key] = {
                    "round": row.round,
                    "event_name": row.event_name,
                    "date": row.date,
                    "circuit_name": row.circuit_name,
                    "circuit_id": row.circuit_id,
                    "track_length_km": row.track_length_km,
                    "session_type": row.session_type,
                    "podium": [],
                }
            rounds_dict[key]["podium"].append(
                RoundPodiumDriver(
                    full_name=row.full_name,
                    driver_code=row.driver_code,
                    driver_slug=_make_slug(row.jolpica_id, row.full_name),
                    country_code=row.country_code,
                    team_name=row.team_name,
                    team_color=row.team_color,
                    logo_url=row.logo_url,
                    headshot_url=row.headshot_url,
                    fastest_lap=row.fastest_lap,
                )
            )

        rounds = [RoundSummary(**round_data) for round_data in rounds_dict.values()]
        return SeasonRoundsResponse(year=season, rounds=rounds)

    @staticmethod
    async def get_sprint_lap_times(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[LapTimesResponse]:
        """
        Get lap-by-lap timing data for all drivers in a specific sprint race.
        """
        session_query = (
            select(Session)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(
                Session.session_type == "sprint_race"
            )  # Corrected from "sprint" based on usage elsewhere
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        # Try finding 'sprint' if 'sprint_race' not found (sometimes data varies)
        if not session:
            session_query = (
                select(Session)
                .where(Session.year == season)
                .where(Session.round == round_num)
                .where(Session.session_type == "sprint")
            )
            session_result = await db.execute(session_query)
            session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get all laps
        laps_query = (
            select(
                Lap.lap_number,
                Lap.lap_time_seconds,
                Lap.compound,
                Lap.tyre_life,
                Lap.stint,
                Lap.track_status,
                Lap.sector1_time_seconds,
                Lap.sector2_time_seconds,
                Lap.sector3_time_seconds,
                Lap.pit_in_time_seconds,
                Lap.pit_out_time_seconds,
                Lap.pit_duration_seconds,
                Lap.position,
                Lap.speed_st,
                Lap.speed_i1,
                Lap.speed_i2,
                Lap.speed_fl,
                Lap.fresh_tyre,
                Lap.is_personal_best,
                Lap.deleted,
                Lap.lap_start_time_seconds,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                Team.team_color,
                SessionResult.position.label("final_position"),
            )
            .join(Driver, Lap.driver_id == Driver.id)
            .join(
                SessionResult,
                (SessionResult.session_id == Lap.session_id)
                & (SessionResult.driver_id == Lap.driver_id),
            )
            .join(Team, SessionResult.team_id == Team.id)
            .where(Lap.session_id == session.id)
            .order_by(SessionResult.position, Lap.lap_number)
        )

        laps_result = await db.execute(laps_query)
        lap_rows = laps_result.all()

        if not lap_rows:
            return None

        # Get track status events and race control messages for this session
        track_status_events = await ResultsService.get_track_status(db, session.id)
        race_control_events = await ResultsService.get_race_control_events(
            db, session.id
        )

        total_laps = max(row.lap_number for row in lap_rows) if lap_rows else None

        drivers_dict = {}
        for row in lap_rows:
            driver_code = row.driver_code

            if driver_code not in drivers_dict:
                drivers_dict[driver_code] = {
                    "driver_code": driver_code,
                    "driver_slug": _make_slug(row.jolpica_id, row.full_name),
                    "full_name": row.full_name,
                    "country_code": row.country_code,
                    "team_color": row.team_color,
                    "final_position": row.final_position,
                    "laps": [],
                }

            drivers_dict[driver_code]["laps"].append(
                LapData(
                    lap_number=row.lap_number,
                    lap_time_seconds=ResultsService.sanitize_float(
                        row.lap_time_seconds
                    ),
                    compound=row.compound,
                    tyre_life=row.tyre_life,
                    stint=row.stint,
                    track_status=row.track_status,
                    sector1_time_seconds=ResultsService.sanitize_float(
                        row.sector1_time_seconds
                    ),
                    sector2_time_seconds=ResultsService.sanitize_float(
                        row.sector2_time_seconds
                    ),
                    sector3_time_seconds=ResultsService.sanitize_float(
                        row.sector3_time_seconds
                    ),
                    pit_in_time_seconds=ResultsService.sanitize_float(
                        row.pit_in_time_seconds
                    ),
                    pit_out_time_seconds=ResultsService.sanitize_float(
                        row.pit_out_time_seconds
                    ),
                    pit_duration_seconds=ResultsService.sanitize_float(
                        row.pit_duration_seconds
                    ),
                    position=row.position,
                    speed_st=ResultsService.sanitize_float(row.speed_st),
                    speed_i1=ResultsService.sanitize_float(row.speed_i1),
                    speed_i2=ResultsService.sanitize_float(row.speed_i2),
                    speed_fl=ResultsService.sanitize_float(row.speed_fl),
                    fresh_tyre=row.fresh_tyre,
                    is_personal_best=row.is_personal_best,
                    deleted=row.deleted,
                )
            )

        drivers = [DriverLapTimesData(**data) for data in drivers_dict.values()]

        return LapTimesResponse(
            year=season,
            round=round_num,
            event_name=session.event_name,
            total_laps=total_laps,
            drivers=drivers,
            track_status_events=track_status_events,
            race_control_events=race_control_events,
        )

    @staticmethod
    async def get_sprint_details(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[SessionResultsResponse]:
        """
        Get full results for a specific sprint race.
        """
        session_query = (
            select(Session)
            .options(selectinload(Session.circuit))
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "sprint_race")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        # Fallback for session type name
        if not session:
            session_query = (
                select(Session)
                .options(selectinload(Session.circuit))
                .where(Session.year == season)
                .where(Session.round == round_num)
                .where(Session.session_type == "sprint")
            )
            session_result = await db.execute(session_query)
            session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get all results
        results_query = (
            select(
                SessionResult,
                Driver,
                Team,
                ResultsService._headshot_fallback_expr().label("headshot_url"),
            )
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.session_id == session.id)
            .order_by(SessionResult.position)
        )

        results = await db.execute(results_query)
        result_rows = results.all()

        circuit = session.circuit

        session_info = SessionInfo(
            id=session.id,
            year=session.year,
            round=session.round,
            session_type=session.session_type,
            event_name=session.event_name,
            date=session.date,
            circuit=CircuitInfo(
                id=circuit.id,
                name=circuit.name,
                location=circuit.location,
                country=circuit.country,
                track_length_km=circuit.track_length_km,
                track_map_url=f"/track-maps/{circuit.id}.png",
            ),
            highlights_video_id=getattr(session, "highlights_video_id", None),
        )

        session_results = [
            SessionResultDetail(
                position=result.SessionResult.position,
                status=result.SessionResult.status,
                headshot_url=result.headshot_url,
                driver=DriverInfo(
                    driver_number=result.Driver.driver_number,
                    driver_code=result.Driver.driver_code,
                    driver_slug=result.Driver.driver_slug,
                    full_name=result.Driver.full_name,
                    country_code=result.Driver.country_code,
                ),
                team=TeamInfo(
                    name=result.Team.name,
                    team_color=result.Team.team_color,
                ),
                grid_position=result.SessionResult.grid_position,
                points=ResultsService.sanitize_float(result.SessionResult.points),
                laps_completed=result.SessionResult.laps_completed,
                time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.time_seconds
                ),
                fastest_lap=result.SessionResult.fastest_lap,
                q1_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q1_time_seconds
                ),
                q2_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q2_time_seconds
                ),
                q3_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q3_time_seconds
                ),
            )
            for result in result_rows
        ]

        return SessionResultsResponse(session=session_info, results=session_results)

    @staticmethod
    async def get_round_details(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[SessionResultsResponse]:
        """
        Get full results for a specific round (main race).
        """
        session_query = (
            select(Session)
            .options(selectinload(Session.circuit))
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "race")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get all results for this session with driver/team info
        results_query = (
            select(
                SessionResult,
                Driver,
                Team,
                ResultsService._headshot_fallback_expr().label("headshot_url"),
            )
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.session_id == session.id)
            .order_by(SessionResult.position)
        )

        results = await db.execute(results_query)
        result_rows = results.all()

        circuit = session.circuit

        session_info = SessionInfo(
            id=session.id,
            year=session.year,
            round=session.round,
            session_type=session.session_type,
            event_name=session.event_name,
            date=session.date,
            circuit=CircuitInfo(
                id=circuit.id,
                name=circuit.name,
                location=circuit.location,
                country=circuit.country,
                track_length_km=circuit.track_length_km,
                track_map_url=f"/track-maps/{circuit.id}.png",
            ),
            highlights_video_id=getattr(session, "highlights_video_id", None),
        )

        session_results = [
            SessionResultDetail(
                position=result.SessionResult.position,
                status=result.SessionResult.status,
                headshot_url=result.headshot_url,
                driver=DriverInfo(
                    driver_number=result.Driver.driver_number,
                    driver_code=result.Driver.driver_code,
                    driver_slug=result.Driver.driver_slug,
                    full_name=result.Driver.full_name,
                    country_code=result.Driver.country_code,
                ),
                team=TeamInfo(
                    name=result.Team.name,
                    team_color=result.Team.team_color,
                ),
                grid_position=result.SessionResult.grid_position,
                points=ResultsService.sanitize_float(result.SessionResult.points),
                laps_completed=result.SessionResult.laps_completed,
                time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.time_seconds
                ),
                fastest_lap=result.SessionResult.fastest_lap,
                q1_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q1_time_seconds
                ),
                q2_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q2_time_seconds
                ),
                q3_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q3_time_seconds
                ),
            )
            for result in result_rows
        ]

        return SessionResultsResponse(session=session_info, results=session_results)

    @staticmethod
    async def get_lap_times(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[LapTimesResponse]:
        """
        Get lap-by-lap timing data for all drivers in a specific race.
        """
        # Get the race session for this round
        session_query = (
            select(Session)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "race")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get all laps for this session with driver and team info
        laps_query = (
            select(
                Lap.lap_number,
                Lap.lap_time_seconds,
                Lap.compound,
                Lap.tyre_life,
                Lap.stint,
                Lap.track_status,
                Lap.sector1_time_seconds,
                Lap.sector2_time_seconds,
                Lap.sector3_time_seconds,
                Lap.pit_in_time_seconds,
                Lap.pit_out_time_seconds,
                Lap.pit_duration_seconds,
                Lap.position,
                Lap.speed_st,
                Lap.speed_i1,
                Lap.speed_i2,
                Lap.speed_fl,
                Lap.fresh_tyre,
                Lap.is_personal_best,
                Lap.deleted,
                Lap.lap_start_time_seconds,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                Team.team_color,
                SessionResult.position.label("final_position"),
            )
            .join(Driver, Lap.driver_id == Driver.id)
            .join(
                SessionResult,
                (SessionResult.session_id == Lap.session_id)
                & (SessionResult.driver_id == Lap.driver_id),
            )
            .join(Team, SessionResult.team_id == Team.id)
            .where(Lap.session_id == session.id)
            .order_by(SessionResult.position, Lap.lap_number)
        )

        laps_result = await db.execute(laps_query)
        lap_rows = laps_result.all()

        if not lap_rows:
            return None

        # Get track status events and race control messages for this session
        track_status_events = await ResultsService.get_track_status(db, session.id)
        race_control_events = await ResultsService.get_race_control_events(
            db, session.id
        )

        # Determine total laps from the max lap number of the race winner
        total_laps = max(row.lap_number for row in lap_rows) if lap_rows else None

        # Group laps by driver
        drivers_dict = {}
        for row in lap_rows:
            driver_code = row.driver_code

            if driver_code not in drivers_dict:
                drivers_dict[driver_code] = {
                    "driver_code": driver_code,
                    "driver_slug": _make_slug(row.jolpica_id, row.full_name),
                    "full_name": row.full_name,
                    "country_code": row.country_code,
                    "team_color": row.team_color,
                    "final_position": row.final_position,
                    "laps": [],
                }

            drivers_dict[driver_code]["laps"].append(
                LapData(
                    lap_number=row.lap_number,
                    lap_time_seconds=ResultsService.sanitize_float(
                        row.lap_time_seconds
                    ),
                    compound=row.compound,
                    tyre_life=row.tyre_life,
                    stint=row.stint,
                    track_status=row.track_status,
                    sector1_time_seconds=ResultsService.sanitize_float(
                        row.sector1_time_seconds
                    ),
                    sector2_time_seconds=ResultsService.sanitize_float(
                        row.sector2_time_seconds
                    ),
                    sector3_time_seconds=ResultsService.sanitize_float(
                        row.sector3_time_seconds
                    ),
                    pit_in_time_seconds=ResultsService.sanitize_float(
                        row.pit_in_time_seconds
                    ),
                    pit_out_time_seconds=ResultsService.sanitize_float(
                        row.pit_out_time_seconds
                    ),
                    pit_duration_seconds=ResultsService.sanitize_float(
                        row.pit_duration_seconds
                    ),
                    position=row.position,
                    speed_st=ResultsService.sanitize_float(row.speed_st),
                    speed_i1=ResultsService.sanitize_float(row.speed_i1),
                    speed_i2=ResultsService.sanitize_float(row.speed_i2),
                    speed_fl=ResultsService.sanitize_float(row.speed_fl),
                    fresh_tyre=row.fresh_tyre,
                    is_personal_best=row.is_personal_best,
                    deleted=row.deleted,
                )
            )

        # Convert to list of DriverLapTimesData
        drivers = [DriverLapTimesData(**data) for data in drivers_dict.values()]

        return LapTimesResponse(
            year=season,
            round=round_num,
            event_name=session.event_name,
            total_laps=total_laps,
            drivers=drivers,
            track_status_events=track_status_events,
            race_control_events=race_control_events,
        )

    @staticmethod
    async def get_qualifying_lap_times(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[LapTimesResponse]:
        """
        Get lap-by-lap timing data for qualifying sessions.
        """
        session_query = (
            select(Session)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "qualifying")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        laps_query = (
            select(
                Lap.lap_number,
                Lap.lap_time_seconds,
                Lap.compound,
                Lap.tyre_life,
                Lap.stint,
                Lap.track_status,
                Lap.sector1_time_seconds,
                Lap.sector2_time_seconds,
                Lap.sector3_time_seconds,
                Lap.pit_in_time_seconds,
                Lap.pit_out_time_seconds,
                Lap.pit_duration_seconds,
                Lap.position,
                Lap.speed_st,
                Lap.speed_i1,
                Lap.speed_i2,
                Lap.speed_fl,
                Lap.fresh_tyre,
                Lap.is_personal_best,
                Lap.deleted,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                Team.team_color,
                SessionResult.position.label("final_position"),
            )
            .join(Driver, Lap.driver_id == Driver.id)
            .join(
                SessionResult,
                (SessionResult.session_id == Lap.session_id)
                & (SessionResult.driver_id == Lap.driver_id),
            )
            .join(Team, SessionResult.team_id == Team.id)
            .where(Lap.session_id == session.id)
            .order_by(SessionResult.position, Lap.lap_number)
        )

        laps_result = await db.execute(laps_query)
        lap_rows = laps_result.all()

        if not lap_rows:
            return None

        drivers_dict = {}
        for row in lap_rows:
            driver_code = row.driver_code

            if driver_code not in drivers_dict:
                drivers_dict[driver_code] = {
                    "driver_code": driver_code,
                    "driver_slug": _make_slug(row.jolpica_id, row.full_name),
                    "full_name": row.full_name,
                    "country_code": row.country_code,
                    "team_color": row.team_color,
                    "final_position": row.final_position,
                    "laps": [],
                }

            drivers_dict[driver_code]["laps"].append(
                LapData(
                    lap_number=row.lap_number,
                    lap_time_seconds=ResultsService.sanitize_float(
                        row.lap_time_seconds
                    ),
                    compound=row.compound,
                    tyre_life=row.tyre_life,
                    stint=row.stint,
                    track_status=row.track_status,
                    sector1_time_seconds=ResultsService.sanitize_float(
                        row.sector1_time_seconds
                    ),
                    sector2_time_seconds=ResultsService.sanitize_float(
                        row.sector2_time_seconds
                    ),
                    sector3_time_seconds=ResultsService.sanitize_float(
                        row.sector3_time_seconds
                    ),
                    pit_in_time_seconds=ResultsService.sanitize_float(
                        row.pit_in_time_seconds
                    ),
                    pit_out_time_seconds=ResultsService.sanitize_float(
                        row.pit_out_time_seconds
                    ),
                    pit_duration_seconds=ResultsService.sanitize_float(
                        row.pit_duration_seconds
                    ),
                    position=row.position,
                    speed_st=ResultsService.sanitize_float(row.speed_st),
                    speed_i1=ResultsService.sanitize_float(row.speed_i1),
                    speed_i2=ResultsService.sanitize_float(row.speed_i2),
                    speed_fl=ResultsService.sanitize_float(row.speed_fl),
                    fresh_tyre=row.fresh_tyre,
                    is_personal_best=row.is_personal_best,
                    deleted=row.deleted,
                )
            )

        drivers = [DriverLapTimesData(**data) for data in drivers_dict.values()]

        return LapTimesResponse(
            year=season,
            round=round_num,
            event_name=session.event_name,
            total_laps=None,
            drivers=drivers,
            track_status_events=[],
        )

    @staticmethod
    async def get_qualifying_sector_comparison(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[QualifyingSectorResponse]:
        """
        Get best sector times per driver for qualifying.
        Returns aggregated best sectors across all qualifying laps.
        """
        session_query = (
            select(Session)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "qualifying")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get best sectors per driver across all qualifying laps
        query = (
            select(
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Team.team_color,
                SessionResult.headshot_url,
                func.min(Lap.sector1_time_seconds).label("best_sector1"),
                func.min(Lap.sector2_time_seconds).label("best_sector2"),
                func.min(Lap.sector3_time_seconds).label("best_sector3"),
                func.min(Lap.lap_time_seconds).label("best_lap_time"),
            )
            .join(Driver, Lap.driver_id == Driver.id)
            .join(
                SessionResult,
                (SessionResult.session_id == Lap.session_id)
                & (SessionResult.driver_id == Lap.driver_id),
            )
            .join(Team, SessionResult.team_id == Team.id)
            .where(Lap.session_id == session.id)
            .where(Lap.deleted.is_(False) | Lap.deleted.is_(None))
            .group_by(
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Team.team_color,
                SessionResult.headshot_url,
            )
            .order_by(func.min(Lap.lap_time_seconds))
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        sectors = [
            QualifyingSectorComparison(
                driver_code=row.driver_code,
                driver_slug=_make_slug(row.jolpica_id, row.full_name),
                full_name=row.full_name,
                team_color=row.team_color,
                headshot_url=row.headshot_url,
                best_sector1=ResultsService.sanitize_float(row.best_sector1),
                best_sector2=ResultsService.sanitize_float(row.best_sector2),
                best_sector3=ResultsService.sanitize_float(row.best_sector3),
                best_lap_time=ResultsService.sanitize_float(row.best_lap_time),
                q_session="Q",
            )
            for row in rows
        ]

        return QualifyingSectorResponse(
            year=season,
            round=round_num,
            event_name=session.event_name,
            sectors=sectors,
        )

    @staticmethod
    async def get_track_status(
        db: AsyncSession, session_id: int
    ) -> List[TrackStatusEvent]:
        """
        Get all track status change events for a session.
        Returns events sorted by time.
        """
        query = (
            select(
                TrackStatus.session_time_seconds,
                TrackStatus.status,
                TrackStatus.message,
            )
            .where(TrackStatus.session_id == session_id)
            .order_by(TrackStatus.session_time_seconds)
        )

        result = await db.execute(query)
        rows = result.all()

        return [
            TrackStatusEvent(
                session_time_seconds=row.session_time_seconds,
                status=row.status,
                message=row.message,
            )
            for row in rows
        ]

    @staticmethod
    async def get_race_control_events(
        db: AsyncSession, session_id: int
    ) -> List[RaceControlEvent]:
        """
        Get race control messages for a session.
        Returns key events sorted by time.
        """
        query = (
            select(
                RaceControlMessage.session_time_seconds,
                RaceControlMessage.lap_number,
                RaceControlMessage.category,
                RaceControlMessage.message,
                RaceControlMessage.flag,
                RaceControlMessage.scope,
                RaceControlMessage.driver_number,
            )
            .where(RaceControlMessage.session_id == session_id)
            .order_by(RaceControlMessage.session_time_seconds)
        )

        result = await db.execute(query)
        rows = result.all()

        return [
            RaceControlEvent(
                session_time_seconds=row.session_time_seconds,
                lap_number=row.lap_number,
                category=row.category,
                message=row.message,
                flag=row.flag,
                scope=row.scope,
                driver_number=row.driver_number,
            )
            for row in rows
        ]

    @staticmethod
    async def get_weather_data(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[WeatherResponse]:
        """
        Get weather data for a race session.
        """
        session_query = (
            select(Session)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "race")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        query = (
            select(
                Weather.session_time_seconds,
                Weather.air_temp,
                Weather.track_temp,
                Weather.humidity,
                Weather.pressure,
                Weather.wind_speed,
                Weather.wind_direction,
                Weather.rainfall,
            )
            .where(Weather.session_id == session.id)
            .order_by(Weather.session_time_seconds)
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        weather = [
            WeatherDataPoint(
                session_time_seconds=row.session_time_seconds,
                air_temp=row.air_temp,
                track_temp=row.track_temp,
                humidity=row.humidity,
                pressure=row.pressure,
                wind_speed=row.wind_speed,
                wind_direction=row.wind_direction,
                rainfall=row.rainfall,
            )
            for row in rows
        ]

        return WeatherResponse(
            year=season,
            round=round_num,
            event_name=session.event_name,
            weather=weather,
        )

    @staticmethod
    async def get_qualifying_details(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[SessionResultsResponse]:
        """
        Get full qualifying results for a specific round.
        """
        session_query = (
            select(Session)
            .options(selectinload(Session.circuit))
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "qualifying")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get all results for this qualifying session with driver/team info
        results_query = (
            select(
                SessionResult,
                Driver,
                Team,
                ResultsService._headshot_fallback_expr().label("headshot_url"),
            )
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.session_id == session.id)
            .order_by(SessionResult.position)
        )

        results = await db.execute(results_query)
        result_rows = results.all()

        circuit = session.circuit

        session_info = SessionInfo(
            id=session.id,
            year=session.year,
            round=session.round,
            session_type=session.session_type,
            event_name=session.event_name,
            date=session.date,
            circuit=CircuitInfo(
                id=circuit.id,
                name=circuit.name,
                location=circuit.location,
                country=circuit.country,
                track_length_km=circuit.track_length_km,
                track_map_url=f"/track-maps/{circuit.id}.png",
            ),
            highlights_video_id=getattr(session, "highlights_video_id", None),
        )

        session_results = [
            SessionResultDetail(
                position=result.SessionResult.position,
                status=result.SessionResult.status,
                headshot_url=result.headshot_url,
                driver=DriverInfo(
                    driver_number=result.Driver.driver_number,
                    driver_code=result.Driver.driver_code,
                    driver_slug=result.Driver.driver_slug,
                    full_name=result.Driver.full_name,
                    country_code=result.Driver.country_code,
                ),
                team=TeamInfo(
                    name=result.Team.name,
                    team_color=result.Team.team_color,
                ),
                grid_position=result.SessionResult.grid_position,
                points=ResultsService.sanitize_float(result.SessionResult.points),
                laps_completed=result.SessionResult.laps_completed,
                time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.time_seconds
                ),
                fastest_lap=result.SessionResult.fastest_lap,
                q1_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q1_time_seconds
                ),
                q2_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q2_time_seconds
                ),
                q3_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q3_time_seconds
                ),
            )
            for result in result_rows
        ]

        return SessionResultsResponse(session=session_info, results=session_results)

    @staticmethod
    async def get_sprint_qualifying_details(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[SessionResultsResponse]:
        """
        Get full sprint qualifying results for a specific round.
        """
        session_query = (
            select(Session)
            .options(selectinload(Session.circuit))
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "sprint_qualifying")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get all results for this sprint qualifying session with driver/team info
        results_query = (
            select(
                SessionResult,
                Driver,
                Team,
                ResultsService._headshot_fallback_expr().label("headshot_url"),
            )
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.session_id == session.id)
            .order_by(SessionResult.position)
        )

        results = await db.execute(results_query)
        result_rows = results.all()

        circuit = session.circuit

        session_info = SessionInfo(
            id=session.id,
            year=session.year,
            round=session.round,
            session_type=session.session_type,
            event_name=session.event_name,
            date=session.date,
            circuit=CircuitInfo(
                id=circuit.id,
                name=circuit.name,
                location=circuit.location,
                country=circuit.country,
                track_length_km=circuit.track_length_km,
                track_map_url=f"/track-maps/{circuit.id}.png",
            ),
            highlights_video_id=getattr(session, "highlights_video_id", None),
        )

        session_results = [
            SessionResultDetail(
                position=result.SessionResult.position,
                status=result.SessionResult.status,
                headshot_url=result.headshot_url,
                driver=DriverInfo(
                    driver_number=result.Driver.driver_number,
                    driver_code=result.Driver.driver_code,
                    driver_slug=result.Driver.driver_slug,
                    full_name=result.Driver.full_name,
                    country_code=result.Driver.country_code,
                ),
                team=TeamInfo(
                    name=result.Team.name,
                    team_color=result.Team.team_color,
                ),
                grid_position=result.SessionResult.grid_position,
                points=ResultsService.sanitize_float(result.SessionResult.points),
                laps_completed=result.SessionResult.laps_completed,
                time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.time_seconds
                ),
                fastest_lap=result.SessionResult.fastest_lap,
                q1_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q1_time_seconds
                ),
                q2_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q2_time_seconds
                ),
                q3_time_seconds=ResultsService.sanitize_float(
                    result.SessionResult.q3_time_seconds
                ),
            )
            for result in result_rows
        ]

        return SessionResultsResponse(session=session_info, results=session_results)

    @staticmethod
    async def get_season_qualifying_rounds(
        db: AsyncSession, season: int
    ) -> Optional[SeasonRoundsResponse]:
        """
        Get all qualifying rounds for a season with top 3 qualifiers for each.
        Includes both regular qualifying and sprint qualifying.
        """
        query = (
            select(
                Session.round,
                Session.event_name,
                Session.date,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                Circuit.id.label("circuit_id"),
                Circuit.track_length_km,
                SessionResult.position,
                Driver.full_name,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.country_code,
                ResultsService._headshot_fallback_expr().label("headshot_url"),
                Team.name.label("team_name"),
                Team.team_color,
                SessionResult.fastest_lap,
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .where(SessionResult.position.between(1, 3))
            .order_by(
                Session.round,
                Session.date,
                SessionResult.position,
            )
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        rounds_dict = {}
        for row in rows:
            key = (row.round, row.session_type)
            if key not in rounds_dict:
                rounds_dict[key] = {
                    "round": row.round,
                    "event_name": row.event_name,
                    "date": row.date,
                    "circuit_name": row.circuit_name,
                    "circuit_id": row.circuit_id,
                    "track_length_km": row.track_length_km,
                    "session_type": row.session_type,
                    "podium": [],
                }
            rounds_dict[key]["podium"].append(
                RoundPodiumDriver(
                    full_name=row.full_name,
                    driver_code=row.driver_code,
                    driver_slug=_make_slug(row.jolpica_id, row.full_name),
                    country_code=row.country_code,
                    team_name=row.team_name,
                    team_color=row.team_color,
                    headshot_url=row.headshot_url,
                    fastest_lap=row.fastest_lap,
                )
            )

        rounds = [RoundSummary(**round_data) for round_data in rounds_dict.values()]
        return SeasonRoundsResponse(year=season, rounds=rounds)

    @staticmethod
    async def get_lap_distribution(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[LapDistributionResponse]:
        """
        Get lap time distribution data for all drivers in a specific race.

        Returns only valid laps (non-null lap_time_seconds) with compound info,
        grouped by driver and sorted by finishing position. Used for the ridge
        plot distribution chart.
        """
        session_query = (
            select(Session)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "race")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        laps_query = (
            select(
                Lap.lap_number,
                Lap.lap_time_seconds,
                Lap.compound,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Team.team_color,
                SessionResult.position.label("final_position"),
            )
            .join(Driver, Lap.driver_id == Driver.id)
            .join(
                SessionResult,
                (SessionResult.session_id == Lap.session_id)
                & (SessionResult.driver_id == Lap.driver_id),
            )
            .join(Team, SessionResult.team_id == Team.id)
            .where(Lap.session_id == session.id)
            .where(Lap.lap_time_seconds.isnot(None))
            .order_by(SessionResult.position, Lap.lap_number)
        )

        laps_result = await db.execute(laps_query)
        lap_rows = laps_result.all()

        if not lap_rows:
            return None

        drivers_dict: dict = {}
        for row in lap_rows:
            key = row.driver_code or row.full_name
            if key not in drivers_dict:
                drivers_dict[key] = {
                    "driver_code": row.driver_code,
                    "driver_slug": _make_slug(row.jolpica_id, row.full_name),
                    "full_name": row.full_name,
                    "team_color": row.team_color,
                    "final_position": row.final_position,
                    "laps": [],
                }

            t = ResultsService.sanitize_float(row.lap_time_seconds)
            if t is not None:
                drivers_dict[key]["laps"].append(
                    DistributionLap(
                        lap_number=row.lap_number,
                        lap_time_seconds=t,
                        compound=row.compound,
                    )
                )

        drivers = [DriverLapDistribution(**data) for data in drivers_dict.values()]

        return LapDistributionResponse(
            year=season,
            round=round_num,
            event_name=session.event_name,
            drivers=drivers,
        )
