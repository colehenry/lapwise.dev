"""
Results Service

Business logic for fetching and processing season results data.
Extracted from season_results.py router for better separation of concerns.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import math

from app.models import Session, SessionResult, Driver, Team, Circuit, Lap
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
    SessionResultsResponse,
    SessionInfo,
    CircuitInfo,
    SessionResultDetail,
    DriverInfo,
    TeamInfo,
)


class ResultsService:
    """Service class for results-related operations"""

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
                SessionResult.position,
                Driver.full_name,
                Driver.driver_code,
                Driver.country_code,
                SessionResult.headshot_url,
                Team.name.label("team_name"),
                Team.team_color,
                SessionResult.fastest_lap,
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
    async def get_season_standings(db: AsyncSession, season: int) -> Optional[StandingsResponse]:
        """
        Get driver and constructor championship standings for a season.
        """
        # Check if season exists
        season_check = await db.execute(select(Session.id).where(Session.year == season).limit(1))
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
                select(SessionResult, Team)
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
                session_result, team = latest_results[driver_id]
                driver_standings_data.append(
                    {
                        "driver_code": driver_row.driver_code,
                        "full_name": driver_row.full_name,
                        "country_code": driver_row.country_code,
                        "total_points": driver_row.total_points,
                        "team_name": team.name,
                        "team_color": team.team_color,
                        "headshot_url": session_result.headshot_url
                        if session_result.headshot_url != "None"
                        else None,
                    }
                )

        if not driver_standings_data:
            return None

        # Build driver standings with position
        drivers = [
            DriverStanding(
                position=idx + 1,
                driver_code=row["driver_code"],
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
        # Sum points grouped by team
        constructor_query = (
            select(
                Team.name.label("team_name"),
                Team.team_color,
                func.sum(SessionResult.points).label("total_points"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(SessionResult.points.isnot(None))
            .group_by(Team.id, Team.name, Team.team_color)
            .order_by(func.sum(SessionResult.points).desc())
        )

        constructor_result = await db.execute(constructor_query)
        constructor_rows = constructor_result.all()

        constructors = [
            ConstructorStanding(
                position=idx + 1,
                team_name=row.team_name,
                team_color=row.team_color,
                total_points=float(row.total_points),
            )
            for idx, row in enumerate(constructor_rows)
        ]

        return StandingsResponse(year=season, drivers=drivers, constructors=constructors)

    @staticmethod
    async def get_points_progression(
        db: AsyncSession, season: int, mode: str
    ) -> Optional[PointsProgressionResponse]:
        """
        Get cumulative points progression throughout a season.
        """
        if mode == "drivers":
            return await ResultsService._get_driver_progression(db, season)
        else:
            return await ResultsService._get_constructor_progression(db, season)

    @staticmethod
    async def _get_driver_progression(
        db: AsyncSession, season: int
    ) -> Optional[PointsProgressionResponse]:
        query = (
            select(
                Driver.driver_code,
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

        # Group by driver
        drivers_dict = {}
        for row in rows:
            key = row.driver_code
            if key not in drivers_dict:
                drivers_dict[key] = {
                    "driver_code": row.driver_code,
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
                Driver.country_code,
                SessionResult.headshot_url,
                Team.name.label("team_name"),
                Team.team_color,
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
            .where(Session.session_type == "sprint_race") # Corrected from "sprint" based on usage elsewhere
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
                Lap.track_status,
                Driver.driver_code,
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
                    "full_name": row.full_name,
                    "country_code": row.country_code,
                    "team_color": row.team_color,
                    "final_position": row.final_position,
                    "laps": [],
                }

            drivers_dict[driver_code]["laps"].append(
                LapData(
                    lap_number=row.lap_number,
                    lap_time_seconds=ResultsService.sanitize_float(row.lap_time_seconds),
                    compound=row.compound,
                    tyre_life=row.tyre_life,
                    track_status=row.track_status,
                )
            )

        drivers = [DriverLapTimesData(**data) for data in drivers_dict.values()]

        return LapTimesResponse(
            year=season, round=round_num, event_name=session.event_name, drivers=drivers
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
            select(SessionResult, Driver, Team)
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
        )

        session_results = [
            SessionResultDetail(
                position=result.SessionResult.position,
                status=result.SessionResult.status,
                headshot_url=result.SessionResult.headshot_url,
                driver=DriverInfo(
                    driver_number=result.Driver.driver_number,
                    driver_code=result.Driver.driver_code,
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
                time_seconds=ResultsService.sanitize_float(result.SessionResult.time_seconds),
                fastest_lap=result.SessionResult.fastest_lap,
                q1_time_seconds=ResultsService.sanitize_float(result.SessionResult.q1_time_seconds),
                q2_time_seconds=ResultsService.sanitize_float(result.SessionResult.q2_time_seconds),
                q3_time_seconds=ResultsService.sanitize_float(result.SessionResult.q3_time_seconds),
            )
            for result in result_rows
        ]

        return SessionResultsResponse(session_info=session_info, results=session_results)
