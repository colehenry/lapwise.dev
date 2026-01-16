"""
Season Results Router

API endpoints for season standings and round summaries.
These endpoints power the new /results/[season] page.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
import math

from app.database import get_db
from app.models import Session, SessionResult, Driver, Team, Circuit, Lap
from app.security import verify_api_key


def sanitize_float(value: Optional[float]) -> Optional[float]:
    """Convert inf/nan float values to None for JSON serialization"""
    if value is None:
        return None
    if math.isnan(value) or math.isinf(value):
        return None
    return value
from app.schemas.result import (
    StandingsResponse,
    DriverStanding,
    ConstructorStanding,
    SeasonRoundsResponse,
    RoundSummary,
    RoundPodiumDriver,
    SessionResultsResponse,
    PointsProgressionResponse,
    DriverProgressionData,
    ConstructorProgressionData,
    PointsProgressionRound,
    LapTimesResponse,
    DriverLapTimesData,
    LapData,
)

router = APIRouter()


@router.get("/seasons", response_model=List[int])
async def get_available_seasons(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get all available seasons/years that have session data.

    Returns a list of years in descending order (newest first).
    """
    query = select(Session.year).distinct().order_by(Session.year.desc())

    result = await db.execute(query)
    seasons = [row[0] for row in result.all()]

    if not seasons:
        raise HTTPException(
            status_code=404, detail="No seasons found"
        )

    return seasons


@router.get("/{season}/standings", response_model=StandingsResponse)
async def get_season_standings(
    season: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get driver and constructor championship standings for a season.

    Calculates total points by summing all session results (races, sprints, etc.)
    for each driver and team.
    """

    # ========================================================================
    # Driver Standings Query
    # ========================================================================
    # Sum points grouped by driver, ordered by total points descending
    # Note: We get headshot_url from the session_results (it's stored per session)
    # We'll get the first non-null headshot for each driver
    driver_query = (
        select(
            Driver.driver_code,
            Driver.full_name,
            Team.name.label("team_name"),
            Team.team_color,
            func.max(SessionResult.headshot_url).label("headshot_url"),  # Get any headshot
            func.sum(SessionResult.points).label("total_points"),
        )
        .join(SessionResult, Driver.id == SessionResult.driver_id)
        .join(Team, SessionResult.team_id == Team.id)
        .join(Session, SessionResult.session_id == Session.id)
        .where(Session.year == season)
        .where(SessionResult.points.isnot(None))  # Exclude NULL points
        .group_by(
            Driver.id,
            Driver.driver_code,
            Driver.full_name,
            Team.name,
            Team.team_color,
        )
        .order_by(func.sum(SessionResult.points).desc())
    )

    driver_result = await db.execute(driver_query)
    driver_rows = driver_result.all()

    if not driver_rows:
        raise HTTPException(
            status_code=404, detail=f"No results found for season {season}"
        )

    # Build driver standings with position
    drivers = [
        DriverStanding(
            position=idx + 1,
            driver_code=row.driver_code,
            full_name=row.full_name,
            team_name=row.team_name,
            team_color=row.team_color,
            total_points=float(row.total_points),
            headshot_url=row.headshot_url,
        )
        for idx, row in enumerate(driver_rows)
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


@router.get("/{season}/points-progression", response_model=PointsProgressionResponse)
async def get_points_progression(
    season: int,
    mode: str = "drivers",
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get cumulative points progression throughout a season.

    Returns round-by-round cumulative points for drivers or constructors.
    Includes round 0 with 0 points for all entities as the starting point.

    Args:
        season: The year to get progression data for
        mode: Either 'drivers' or 'constructors' (default: 'drivers')
    """
    if mode not in ["drivers", "constructors"]:
        raise HTTPException(
            status_code=400,
            detail="Mode must be either 'drivers' or 'constructors'"
        )

    if mode == "drivers":
        # Get all sessions that award points (race and sprint_race)
        # Calculate cumulative sum using window function
        query = (
            select(
                Driver.driver_code,
                Driver.full_name,
                Team.team_color,
                Session.round,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                func.sum(
                    func.coalesce(SessionResult.points, 0)
                ).over(
                    partition_by=Driver.id,
                    order_by=(Session.round, Session.session_type.desc())  # sprint_race before race
                ).label("cumulative_points")
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .distinct(Driver.id, Session.round, Session.session_type, Team.team_color, Circuit.name)
            .order_by(Driver.id, Session.round, Session.session_type.desc())
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            raise HTTPException(
                status_code=404,
                detail=f"No points data found for season {season}"
            )

        # Get all sessions (sprint and race) with their details
        sessions_query = (
            select(
                Session.round,
                Session.event_name,
                Session.session_type
            )
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .order_by(Session.round, Session.session_type.desc())  # sprint_race before race alphabetically
        )
        sessions_result = await db.execute(sessions_query)
        all_sessions = [(row.round, row.event_name, row.session_type) for row in sessions_result.all()]

        # Group by driver and track points per session
        drivers_dict = {}
        for row in rows:
            key = row.driver_code
            if key not in drivers_dict:
                drivers_dict[key] = {
                    "driver_code": row.driver_code,
                    "full_name": row.full_name,
                    "team_color": row.team_color,
                    "sessions_data": {}
                }
            # Store cumulative points per round
            if row.round not in drivers_dict[key]["sessions_data"]:
                drivers_dict[key]["sessions_data"][row.round] = {}
            drivers_dict[key]["sessions_data"][row.round][row.session_type] = float(row.cumulative_points)

        # Build progression with sprint and race as separate data points
        for driver_data in drivers_dict.values():
            progression = [PointsProgressionRound(round="0", cumulative_points=0.0, event_name=None)]
            last_points = 0.0

            for round_num, event_name, session_type in all_sessions:
                round_data = driver_data["sessions_data"].get(round_num, {})

                if session_type in round_data:
                    # Driver participated in this session
                    last_points = round_data[session_type]
                # If not, carry forward last_points

                # Create round identifier: "21-sprint" for sprint, "21" for race
                round_id = f"{round_num}-sprint" if session_type == "sprint_race" else str(round_num)

                progression.append(
                    PointsProgressionRound(
                        round=round_id,
                        cumulative_points=last_points,
                        event_name=event_name
                    )
                )

            driver_data["progression"] = progression
            del driver_data["sessions_data"]  # Clean up temporary data

        # Calculate final positions based on final points
        sorted_drivers = sorted(
            drivers_dict.values(),
            key=lambda d: d["progression"][-1].cumulative_points,
            reverse=True
        )
        for idx, driver_data in enumerate(sorted_drivers):
            driver_data["final_position"] = idx + 1

        drivers = [
            DriverProgressionData(**data) for data in drivers_dict.values()
        ]

        return PointsProgressionResponse(
            year=season,
            type="drivers",
            drivers=drivers,
            constructors=None
        )

    else:
        # Constructor Points Progression Query
        query = (
            select(
                Team.name.label("team_name"),
                Team.team_color,
                Session.round,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                func.sum(
                    func.coalesce(SessionResult.points, 0)
                ).over(
                    partition_by=Team.id,
                    order_by=(Session.round, Session.session_type.desc())
                ).label("cumulative_points")
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
            raise HTTPException(
                status_code=404,
                detail=f"No points data found for season {season}"
            )

        # Get all sessions (sprint and race) with their details
        sessions_query = (
            select(
                Session.round,
                Session.event_name,
                Session.session_type
            )
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .order_by(Session.round, Session.session_type.desc())
        )
        sessions_result = await db.execute(sessions_query)
        all_sessions = [(row.round, row.event_name, row.session_type) for row in sessions_result.all()]

        # Group by team and track points per session
        teams_dict = {}
        for row in rows:
            key = row.team_name
            if key not in teams_dict:
                teams_dict[key] = {
                    "team_name": row.team_name,
                    "team_color": row.team_color,
                    "sessions_data": {}
                }
            if row.round not in teams_dict[key]["sessions_data"]:
                teams_dict[key]["sessions_data"][row.round] = {}
            teams_dict[key]["sessions_data"][row.round][row.session_type] = float(row.cumulative_points)

        # Build progression with sprint and race as separate data points
        for team_data in teams_dict.values():
            progression = [PointsProgressionRound(round="0", cumulative_points=0.0, event_name=None)]
            last_points = 0.0

            for round_num, event_name, session_type in all_sessions:
                round_data = team_data["sessions_data"].get(round_num, {})

                if session_type in round_data:
                    last_points = round_data[session_type]

                # Create round identifier: "21-sprint" for sprint, "21" for race
                round_id = f"{round_num}-sprint" if session_type == "sprint_race" else str(round_num)

                progression.append(
                    PointsProgressionRound(
                        round=round_id,
                        cumulative_points=last_points,
                        event_name=event_name
                    )
                )

            team_data["progression"] = progression
            del team_data["sessions_data"]  # Clean up temporary data

        # Calculate final positions based on final points
        sorted_teams = sorted(
            teams_dict.values(),
            key=lambda t: t["progression"][-1].cumulative_points,
            reverse=True
        )
        for idx, team_data in enumerate(sorted_teams):
            team_data["final_position"] = idx + 1

        constructors = [
            ConstructorProgressionData(**data) for data in teams_dict.values()
        ]

        return PointsProgressionResponse(
            year=season,
            type="constructors",
            drivers=None,
            constructors=constructors
        )


@router.get("/{season}", response_model=SeasonRoundsResponse)
async def get_season_rounds(
    season: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get all rounds for a season with top 3 finishers for each.

    Returns race sessions (not qualifying) showing podium finishers.
    Used for the main /results/[season] page to display all races.
    """

    # Get all race sessions for the season (including sprint races)
    # We'll get the top 3 for each
    query = (
        select(
            Session.round,
            Session.event_name,
            Session.date,
            Session.session_type,
            Circuit.name.label("circuit_name"),
            SessionResult.position,
            Driver.full_name,
            Driver.driver_code,
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
        .where(Session.session_type.in_(["race", "sprint_race"]))  # Only races, not qualifying
        .where(SessionResult.position.between(1, 3))  # Top 3 only
        .order_by(
            Session.round,
            Session.date,  # Order by date to get sprint before race (sprint happens earlier)
            SessionResult.position
        )
    )

    result = await db.execute(query)
    rows = result.all()

    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No race results found for season {season}"
        )

    # Group by round and session_type
    rounds_dict = {}
    for row in rows:
        key = (row.round, row.session_type)
        if key not in rounds_dict:
            rounds_dict[key] = {
                "round": row.round,
                "event_name": row.event_name,
                "date": row.date,
                "circuit_name": row.circuit_name,
                "session_type": row.session_type,
                "podium": [],
            }
        rounds_dict[key]["podium"].append(
            RoundPodiumDriver(
                full_name=row.full_name,
                driver_code=row.driver_code,
                team_name=row.team_name,
                team_color=row.team_color,
                headshot_url=row.headshot_url,
                fastest_lap=row.fastest_lap,
            )
        )

    # Convert to list and create RoundSummary objects
    rounds = [RoundSummary(**round_data) for round_data in rounds_dict.values()]

    return SeasonRoundsResponse(year=season, rounds=rounds)


@router.get("/{season}/{round}/sprint/lap-times", response_model=LapTimesResponse)
async def get_sprint_lap_times(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get lap-by-lap timing data for all drivers in a specific sprint race.

    Returns all laps (including pit in/out laps and deleted laps) with timing,
    tyre, and track status information. Used for lap time visualization graphs.
    """

    # Get the sprint session for this round
    session_query = (
        select(Session)
        .where(Session.year == season)
        .where(Session.round == round)
        .where(Session.session_type == "sprint")
    )

    session_result = await db.execute(session_query)
    session = session_result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"No sprint session found for season {season}, round {round}",
        )

    # Get all laps for this session with driver and team info
    # Join: Lap -> Driver -> SessionResult (for final position) -> Team
    laps_query = (
        select(
            Lap.lap_number,
            Lap.lap_time_seconds,
            Lap.compound,
            Lap.tyre_life,
            Lap.track_status,
            Driver.driver_code,
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
        .order_by(SessionResult.position, Lap.lap_number)
    )

    laps_result = await db.execute(laps_query)
    lap_rows = laps_result.all()

    if not lap_rows:
        raise HTTPException(
            status_code=404,
            detail=f"No lap data found for sprint in season {season}, round {round}",
        )

    # Group laps by driver
    drivers_dict = {}
    for row in lap_rows:
        driver_code = row.driver_code

        if driver_code not in drivers_dict:
            drivers_dict[driver_code] = {
                "driver_code": driver_code,
                "full_name": row.full_name,
                "team_color": row.team_color,
                "final_position": row.final_position,
                "laps": [],
            }

        drivers_dict[driver_code]["laps"].append(
            LapData(
                lap_number=row.lap_number,
                lap_time_seconds=sanitize_float(row.lap_time_seconds),
                compound=row.compound,
                tyre_life=row.tyre_life,
                track_status=row.track_status,
            )
        )

    # Convert to list of DriverLapTimesData
    drivers = [DriverLapTimesData(**data) for data in drivers_dict.values()]

    return LapTimesResponse(
        year=season, round=round, event_name=session.event_name, drivers=drivers
    )


@router.get("/{season}/{round}/sprint", response_model=SessionResultsResponse)
async def get_sprint_details(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get full results for a specific sprint race.

    Returns all drivers and their complete sprint session data.
    Used for the /results/[season]/[round]/sprint detail page.
    """

    # Get the sprint race session for this round
    # Use selectinload to eagerly load the circuit relationship to avoid lazy loading issues
    session_query = (
        select(Session)
        .options(selectinload(Session.circuit))
        .where(Session.year == season)
        .where(Session.round == round)
        .where(Session.session_type == "sprint_race")
    )

    session_result = await db.execute(session_query)
    session = session_result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"No sprint race found for season {season}, round {round}",
        )

    # Get all results for this session with driver/team info
    results_query = (
        select(SessionResult, Driver, Team)
        .join(Driver, SessionResult.driver_id == Driver.id)
        .join(Team, SessionResult.team_id == Team.id)
        .where(SessionResult.session_id == session.id)
        .order_by(SessionResult.position)
    )

    results = await db.execute(results_query)
    result_rows = results.all()

    # Build response
    from app.schemas.result import (
        SessionInfo,
        CircuitInfo,
        SessionResultDetail,
        DriverInfo,
        TeamInfo,
    )

    # Get circuit info
    circuit = session.circuit

    session_info = SessionInfo(
        id=session.id,
        year=session.year,
        round=session.round,
        session_type=session.session_type,
        event_name=session.event_name,
        date=session.date,
        circuit=CircuitInfo(
            name=circuit.name,
            location=circuit.location,
            country=circuit.country,
            track_length_km=circuit.track_length_km,
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
            ),
            team=TeamInfo(
                name=result.Team.name,
                team_color=result.Team.team_color,
            ),
            grid_position=result.SessionResult.grid_position,
            points=sanitize_float(result.SessionResult.points),
            laps_completed=result.SessionResult.laps_completed,
            time_seconds=sanitize_float(result.SessionResult.time_seconds),
            fastest_lap=result.SessionResult.fastest_lap,
            q1_time_seconds=sanitize_float(result.SessionResult.q1_time_seconds),
            q2_time_seconds=sanitize_float(result.SessionResult.q2_time_seconds),
            q3_time_seconds=sanitize_float(result.SessionResult.q3_time_seconds),
        )
        for result in result_rows
    ]

    return SessionResultsResponse(session=session_info, results=session_results)


@router.get("/{season}/{round}", response_model=SessionResultsResponse)
async def get_round_details(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get full results for a specific round (main race).

    Returns all drivers and their complete session data.
    Used for the /results/[season]/[round] detail page.
    """

    # Get the race session for this round (not sprint, not qualifying - just the main race)
    # Use selectinload to eagerly load the circuit relationship to avoid lazy loading issues
    session_query = (
        select(Session)
        .options(selectinload(Session.circuit))
        .where(Session.year == season)
        .where(Session.round == round)
        .where(Session.session_type == "race")
    )

    session_result = await db.execute(session_query)
    session = session_result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"No race session found for season {season}, round {round}",
        )

    # Get all results for this session with driver/team info
    results_query = (
        select(SessionResult, Driver, Team)
        .join(Driver, SessionResult.driver_id == Driver.id)
        .join(Team, SessionResult.team_id == Team.id)
        .where(SessionResult.session_id == session.id)
        .order_by(SessionResult.position)
    )

    results = await db.execute(results_query)
    result_rows = results.all()

    # Build response (we'll need to manually construct this based on the schema)
    # This is a simplified version - you may need to adjust based on your exact needs
    from app.schemas.result import (
        SessionInfo,
        CircuitInfo,
        SessionResultDetail,
        DriverInfo,
        TeamInfo,
    )

    # Get circuit info
    circuit = session.circuit

    session_info = SessionInfo(
        id=session.id,
        year=session.year,
        round=session.round,
        session_type=session.session_type,
        event_name=session.event_name,
        date=session.date,
        circuit=CircuitInfo(
            name=circuit.name,
            location=circuit.location,
            country=circuit.country,
            track_length_km=circuit.track_length_km,
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
            ),
            team=TeamInfo(
                name=result.Team.name,
                team_color=result.Team.team_color,
            ),
            grid_position=result.SessionResult.grid_position,
            points=sanitize_float(result.SessionResult.points),
            laps_completed=result.SessionResult.laps_completed,
            time_seconds=sanitize_float(result.SessionResult.time_seconds),
            fastest_lap=result.SessionResult.fastest_lap,
            q1_time_seconds=sanitize_float(result.SessionResult.q1_time_seconds),
            q2_time_seconds=sanitize_float(result.SessionResult.q2_time_seconds),
            q3_time_seconds=sanitize_float(result.SessionResult.q3_time_seconds),
        )
        for result in result_rows
    ]

    return SessionResultsResponse(session=session_info, results=session_results)

@router.get("/{season}/{round}/lap-times", response_model=LapTimesResponse)
async def get_lap_times(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get lap-by-lap timing data for all drivers in a specific race.

    Returns all laps (including pit in/out laps and deleted laps) with timing,
    tyre, and track status information. Used for lap time visualization graphs.
    """

    # Get the race session for this round
    session_query = (
        select(Session)
        .where(Session.year == season)
        .where(Session.round == round)
        .where(Session.session_type == "race")
    )

    session_result = await db.execute(session_query)
    session = session_result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"No race session found for season {season}, round {round}",
        )

    # Get all laps for this session with driver and team info
    # Join: Lap -> Driver -> SessionResult (for final position) -> Team
    laps_query = (
        select(
            Lap.lap_number,
            Lap.lap_time_seconds,
            Lap.compound,
            Lap.tyre_life,
            Lap.track_status,
            Driver.driver_code,
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
        .order_by(SessionResult.position, Lap.lap_number)
    )

    laps_result = await db.execute(laps_query)
    lap_rows = laps_result.all()

    if not lap_rows:
        raise HTTPException(
            status_code=404,
            detail=f"No lap data found for season {season}, round {round}",
        )

    # Group laps by driver
    drivers_dict = {}
    for row in lap_rows:
        driver_code = row.driver_code

        if driver_code not in drivers_dict:
            drivers_dict[driver_code] = {
                "driver_code": driver_code,
                "full_name": row.full_name,
                "team_color": row.team_color,
                "final_position": row.final_position,
                "laps": [],
            }

        drivers_dict[driver_code]["laps"].append(
            LapData(
                lap_number=row.lap_number,
                lap_time_seconds=sanitize_float(row.lap_time_seconds),
                compound=row.compound,
                tyre_life=row.tyre_life,
                track_status=row.track_status,
            )
        )

    # Convert to list of DriverLapTimesData
    drivers = [DriverLapTimesData(**data) for data in drivers_dict.values()]

    return LapTimesResponse(
        year=season, round=round, event_name=session.event_name, drivers=drivers
    )
