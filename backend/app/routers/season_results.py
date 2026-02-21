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
from app.schemas.result import (
    StandingsResponse,
    QualifyingStandingsResponse,
    SeasonRoundsResponse,
    RoundSummary,
    SessionResultsResponse,
    PointsProgressionResponse,
    LapTimesResponse,
    QualifyingSectorResponse,
    WeatherResponse,
)

# Helper function for sanitizing floats
sanitize_float = ResultsService.sanitize_float

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


@router.get(
    "/{season}/qualifying-standings", response_model=QualifyingStandingsResponse
)
async def get_season_qualifying_standings(
    season: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get driver and constructor qualifying championship standings for a season.

    Calculates total qualifying points (P1=20, P2=19, etc.) for each driver and team.
    Used for the /results/[season] page in qualifying view mode.
    """
    standings = await ResultsService.get_qualifying_standings(db, season)

    if not standings:
        raise HTTPException(
            status_code=404, detail=f"No qualifying results found for season {season}"
        )

    return standings


@router.get("/{season}/points-progression", response_model=PointsProgressionResponse)
async def get_points_progression(
    season: int,
    mode: str = "drivers",
    points_type: str = "race",
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
        points_type: Either 'race' or 'qualifying' (default: 'race')
    """
    if mode not in ["drivers", "constructors"]:
        raise HTTPException(
            status_code=400, detail="Mode must be either 'drivers' or 'constructors'"
        )

    if points_type not in ["race", "qualifying"]:
        raise HTTPException(
            status_code=400, detail="points_type must be either 'race' or 'qualifying'"
        )

    progression = await ResultsService.get_points_progression(
        db, season, mode, points_type
    )

    if not progression:
        raise HTTPException(
            status_code=404, detail=f"No points data found for season {season}"
        )

    return progression


@router.get("/{season}/qualifying", response_model=SeasonRoundsResponse)
async def get_season_qualifying_rounds(
    season: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get all qualifying rounds for a season with top 3 qualifiers for each.

    Returns qualifying sessions (both regular and sprint qualifying) showing top 3.
    Used for the /results/[season] page in qualifying view mode.
    """
    rounds = await ResultsService.get_season_qualifying_rounds(db, season)

    if not rounds:
        raise HTTPException(
            status_code=404, detail=f"No qualifying results found for season {season}"
        )

    return rounds


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


@router.get(
    "/{season}/{round}/qualifying/lap-times",
    response_model=LapTimesResponse,
)
async def get_qualifying_lap_times(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get lap-by-lap timing data for qualifying.

    Returns all qualifying laps with sector times, speeds, and tyre data.
    """
    lap_times = await ResultsService.get_qualifying_lap_times(db, season, round)

    if not lap_times:
        raise HTTPException(
            status_code=404,
            detail=(f"No qualifying lap data for " f"season {season}, round {round}"),
        )

    return lap_times


@router.get(
    "/{season}/{round}/qualifying/sectors",
    response_model=QualifyingSectorResponse,
)
async def get_qualifying_sectors(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get best sector times per driver for qualifying.

    Returns aggregated best S1/S2/S3 and lap time per driver.
    """
    sectors = await ResultsService.get_qualifying_sector_comparison(db, season, round)

    if not sectors:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No qualifying sector data for " f"season {season}, round {round}"
            ),
        )

    return sectors


@router.get("/{season}/{round}/qualifying", response_model=SessionResultsResponse)
async def get_qualifying_details(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get full qualifying results for a specific round.

    Returns all drivers and their qualifying session data (Q1/Q2/Q3 times).
    Used for the /results/[season]/[round] page in qualifying view mode.
    """
    results = await ResultsService.get_qualifying_details(db, season, round)

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No qualifying session found for season {season}, round {round}",
        )

    return results


@router.get(
    "/{season}/{round}/sprint-qualifying", response_model=SessionResultsResponse
)
async def get_sprint_qualifying_details(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get full sprint qualifying results for a specific round.

    Returns all drivers and their sprint qualifying session data (Q1/Q2/Q3 times).
    Used for the /results/[season]/[round]/sprint page in qualifying view mode.
    """
    results = await ResultsService.get_sprint_qualifying_details(db, season, round)

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No sprint qualifying session found for season {season}, round {round}",
        )

    return results


@router.get(
    "/{season}/{round}/weather",
    response_model=WeatherResponse,
)
async def get_weather_data(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get weather data for a race session.

    Returns time-series weather data (temp, humidity, rainfall).
    """
    weather = await ResultsService.get_weather_data(db, season, round)

    if not weather:
        raise HTTPException(
            status_code=404,
            detail=(f"No weather data for " f"season {season}, round {round}"),
        )

    return weather


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
    results = await ResultsService.get_round_details(db, season, round)

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No race session found for season {season}, round {round}",
        )

    return results


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
    lap_times = await ResultsService.get_lap_times(db, season, round)

    if not lap_times:
        raise HTTPException(
            status_code=404,
            detail=f"No lap data found for season {season}, round {round}",
        )

    return lap_times
