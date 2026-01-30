"""
Season Results Router

API endpoints for season standings and round summaries.
These endpoints power the new /results/[season] page.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.services.results_service import ResultsService
from app.security import verify_api_key

# Helper function for sanitizing floats
sanitize_float = ResultsService.sanitize_float

from app.schemas.result import (
    StandingsResponse,
    SeasonRoundsResponse,
    RoundSummary,
    SessionResultsResponse,
    PointsProgressionResponse,
    LapTimesResponse,
)

router = APIRouter()


@router.get("/seasons", response_model=List[int])
async def get_available_seasons(
    db: AsyncSession = Depends(get_db), api_key: str = Depends(verify_api_key)
):
    """
    Get all available seasons/years that have session data.

    Returns a list of years in descending order (newest first).
    """
    seasons = await ResultsService.get_available_seasons(db)

    if not seasons:
        raise HTTPException(status_code=404, detail="No seasons found")

    return seasons


@router.get("/latest", response_model=RoundSummary)
async def get_latest_race(
    db: AsyncSession = Depends(get_db), api_key: str = Depends(verify_api_key)
):
    """
    Get the most recent race result with top 3 finishers.

    Returns the latest race session ordered by date, showing podium finishers.
    Used for the homepage to display a quick preview of the most recent race.
    """
    # Get the most recent race session
    latest_session = await ResultsService.get_latest_race_session(db)

    if not latest_session:
        raise HTTPException(status_code=404, detail="No race results found")

    # Get top 3 finishers for this race
    rows = await ResultsService.get_podium_results(db, latest_session.id)

    if not rows:
        raise HTTPException(
            status_code=404, detail="No podium results found for latest race"
        )

    # Build podium list
    from app.schemas.result import RoundPodiumDriver

    podium = [
        RoundPodiumDriver(
            full_name=row.full_name,
            driver_code=row.driver_code,
            country_code=row.country_code,
            team_name=row.team_name,
            team_color=row.team_color,
            headshot_url=row.headshot_url,
            fastest_lap=row.fastest_lap,
        )
        for row in rows
    ]

    # Return the round summary
    first_row = rows[0]
    return RoundSummary(
        round=first_row.round,
        event_name=first_row.event_name,
        date=first_row.date,
        circuit_name=first_row.circuit_name,
        circuit_id=first_row.circuit_id,
        session_type=first_row.session_type,
        podium=podium,
    )


@router.get("/{season}/standings", response_model=StandingsResponse)
async def get_season_standings(
    season: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get driver and constructor championship standings for a season.

    Calculates total points by summing all session results
    (races, sprints, etc.) for each driver and team.
    """
    standings = await ResultsService.get_season_standings(db, season)

    if not standings:
        raise HTTPException(
            status_code=404, detail=f"No results found for season {season}"
        )

    return standings


@router.get("/{season}/points-progression", response_model=PointsProgressionResponse)
async def get_points_progression(
    season: int,
    mode: str = "drivers",
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
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
            status_code=400, detail="Mode must be either 'drivers' or 'constructors'"
        )

    progression = await ResultsService.get_points_progression(db, season, mode)

    if not progression:
        raise HTTPException(
            status_code=404, detail=f"No points data found for season {season}"
        )

    return progression


@router.get("/{season}", response_model=SeasonRoundsResponse)
async def get_season_rounds(
    season: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get all rounds for a season with top 3 finishers for each.

    Returns race sessions (not qualifying) showing podium finishers.
    Used for the main /results/[season] page to display all races.
    """
    rounds = await ResultsService.get_season_rounds(db, season)

    if not rounds:
        raise HTTPException(
            status_code=404, detail=f"No race results found for season {season}"
        )

    return rounds


@router.get("/{season}/{round}/sprint/lap-times", response_model=LapTimesResponse)
async def get_sprint_lap_times(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get lap-by-lap timing data for all drivers in a specific sprint race.

    Returns all laps (including pit in/out laps and deleted laps) with timing,
    tyre, and track status information. Used for lap time visualization graphs.
    """
    lap_times = await ResultsService.get_sprint_lap_times(db, season, round)

    if not lap_times:
        # Try checking if session exists but no laps, or if session missing
        # The service returns None for both, we can't distinguish easily without extra queries
        # but 404 is appropriate for "not found"
        raise HTTPException(
            status_code=404,
            detail=f"No lap data found for sprint in season {season}, round {round}",
        )

    return lap_times


@router.get("/{season}/{round}/sprint", response_model=SessionResultsResponse)
async def get_sprint_details(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get full results for a specific sprint race.

    Returns all drivers and their complete sprint session data.
    Used for the /results/[season]/[round]/sprint detail page.
    """
    results = await ResultsService.get_sprint_details(db, season, round)

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No sprint race found for season {season}, round {round}",
        )

    return results


@router.get("/{season}/{round}", response_model=SessionResultsResponse)
async def get_round_details(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
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
    api_key: str = Depends(verify_api_key),
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
                "country_code": row.country_code,
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
