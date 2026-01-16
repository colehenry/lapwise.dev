"""
Drivers Router

API endpoints for driver profiles and statistics.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional

from app.database import get_db
from app.models import Driver, SessionResult, Session, Team
from app.schemas.driver import (
    DriverProfileResponse,
    DriverSeasonHistoryResponse,
    SeasonHistory,
    DriverRaceHistoryResponse,
    RaceHistory,
)
from app.security import verify_api_key

router = APIRouter()


@router.get("/{driver_code}", response_model=DriverProfileResponse)
async def get_driver_profile(
    driver_code: str,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get complete driver profile with career statistics.

    Returns driver information and calculated career stats including:
    - Total seasons, races, wins, podiums
    - Best finish position
    - Current team (from most recent race)
    - Total championship points

    Args:
        driver_code: 3-letter driver code (e.g., VER, HAM, LEC)
    """

    # Get driver basic info
    driver_query = select(Driver).where(Driver.driver_code == driver_code.upper())
    driver_result = await db.execute(driver_query)
    driver = driver_result.scalar_one_or_none()

    if not driver:
        raise HTTPException(
            status_code=404,
            detail=f"Driver with code '{driver_code}' not found"
        )

    # ========================================================================
    # Calculate Career Statistics
    # ========================================================================

    # Get all race results (not qualifying or practice)
    race_results_query = (
        select(SessionResult, Session, Team)
        .join(Session, SessionResult.session_id == Session.id)
        .join(Team, SessionResult.team_id == Team.id)
        .where(SessionResult.driver_id == driver.id)
        .where(Session.session_type.in_(["race", "sprint_race"]))
        .order_by(Session.date.desc())
    )

    results = await db.execute(race_results_query)
    race_results = results.all()

    if not race_results:
        # Driver exists but has no race results yet
        return DriverProfileResponse(
            driver_code=driver.driver_code,
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

    for result, session, team in race_results:
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

    # Calculate championships (seasons where driver finished P1)
    total_championships = 0
    for year in seasons:
        # Get championship standings for this year
        standings_query = (
            select(
                Driver.id,
                func.sum(SessionResult.points).label("total_points")
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == year)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Driver.id)
            .order_by(func.sum(SessionResult.points).desc())
            .limit(1)  # Only get the champion
        )

        standings_result = await db.execute(standings_query)
        champion = standings_result.first()

        if champion and champion.id == driver.id:
            total_championships += 1

    # Get current team and headshot (from most recent race)
    most_recent = race_results[0]  # Already ordered by date desc
    current_team_name = most_recent.Team.name
    current_team_color = most_recent.Team.team_color
    latest_season = most_recent.Session.year
    headshot_url = most_recent.SessionResult.headshot_url

    return DriverProfileResponse(
        driver_code=driver.driver_code,
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


@router.get("/{driver_code}/season-history", response_model=DriverSeasonHistoryResponse)
async def get_driver_season_history(
    driver_code: str,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get driver's championship position and points for each season.

    Returns year-by-year breakdown of the driver's career showing:
    - Championship position each season
    - Total points scored
    - Team they drove for (uses most common team that season)

    Args:
        driver_code: 3-letter driver code (e.g., VER, HAM, LEC)
    """

    # Get driver basic info
    driver_query = select(Driver).where(Driver.driver_code == driver_code.upper())
    driver_result = await db.execute(driver_query)
    driver = driver_result.scalar_one_or_none()

    if not driver:
        raise HTTPException(
            status_code=404,
            detail=f"Driver with code '{driver_code}' not found"
        )

    # Get all race results grouped by season
    race_results_query = (
        select(
            Session.year,
            func.sum(SessionResult.points).label("total_points"),
            func.max(Team.name).label("team_name"),  # Get most recent team
            func.max(Team.team_color).label("team_color"),
        )
        .join(Session, SessionResult.session_id == Session.id)
        .join(Team, SessionResult.team_id == Team.id)
        .where(SessionResult.driver_id == driver.id)
        .where(Session.session_type.in_(["race", "sprint_race"]))
        .where(SessionResult.points.isnot(None))
        .group_by(Session.year)
        .order_by(Session.year)
    )

    results = await db.execute(race_results_query)
    season_data = results.all()

    if not season_data:
        # Driver exists but has no race results
        return DriverSeasonHistoryResponse(
            driver_code=driver.driver_code,
            full_name=driver.full_name,
            seasons=[],
        )

    # For each season, calculate championship position
    seasons = []
    for season_row in season_data:
        year = season_row.year

        # Get championship standings for this year
        standings_query = (
            select(
                Driver.id,
                func.sum(SessionResult.points).label("total_points")
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == year)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Driver.id)
            .order_by(func.sum(SessionResult.points).desc())
        )

        standings_result = await db.execute(standings_query)
        standings = standings_result.all()

        # Find driver's position
        championship_position = None
        for idx, standing in enumerate(standings):
            if standing.id == driver.id:
                championship_position = idx + 1
                break

        seasons.append(
            SeasonHistory(
                year=year,
                championship_position=championship_position,
                total_points=float(season_row.total_points),
                team_name=season_row.team_name,
                team_color=season_row.team_color,
            )
        )

    return DriverSeasonHistoryResponse(
        driver_code=driver.driver_code,
        full_name=driver.full_name,
        seasons=seasons,
    )


@router.get("/{driver_code}/race-history", response_model=DriverRaceHistoryResponse)
async def get_driver_race_history(
    driver_code: str,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get driver's race-by-race results across their career.

    Returns individual race results with position, points, and team info.
    Can be filtered by year range (max 5 years).

    Args:
        driver_code: 3-letter driver code (e.g., VER, HAM, LEC)
        start_year: Starting year (optional, defaults to last 5 years)
        end_year: Ending year (optional, defaults to most recent year)
    """

    # Get driver basic info
    driver_query = select(Driver).where(Driver.driver_code == driver_code.upper())
    driver_result = await db.execute(driver_query)
    driver = driver_result.scalar_one_or_none()

    if not driver:
        raise HTTPException(
            status_code=404,
            detail=f"Driver with code '{driver_code}' not found"
        )

    # Get all available years for this driver
    years_query = (
        select(Session.year)
        .join(SessionResult, Session.id == SessionResult.session_id)
        .where(SessionResult.driver_id == driver.id)
        .where(Session.session_type.in_(["race", "sprint_race"]))
        .distinct()
        .order_by(Session.year.desc())
    )
    years_result = await db.execute(years_query)
    available_years = [row[0] for row in years_result.all()]

    if not available_years:
        return DriverRaceHistoryResponse(
            driver_code=driver.driver_code,
            full_name=driver.full_name,
            races=[],
            available_years=[],
        )

    # Determine year range (default to last 5 years)
    if end_year is None:
        end_year = available_years[0]  # Most recent year
    if start_year is None:
        start_year = max(end_year - 4, available_years[-1])  # 5 years or start of career

    # Validate range
    if end_year - start_year > 4:
        raise HTTPException(
            status_code=400,
            detail="Year range cannot exceed 5 years"
        )

    # Get all race results in the year range
    race_results_query = (
        select(
            Session.year,
            Session.round,
            Session.event_name,
            SessionResult.position,
            SessionResult.points,
            SessionResult.status,
            Team.name.label("team_name"),
            Team.team_color,
            Session.date,
        )
        .join(SessionResult, Session.id == SessionResult.session_id)
        .join(Team, SessionResult.team_id == Team.id)
        .where(SessionResult.driver_id == driver.id)
        .where(Session.session_type.in_(["race", "sprint_race"]))
        .where(Session.year >= start_year)
        .where(Session.year <= end_year)
        .order_by(Session.date)
    )

    results = await db.execute(race_results_query)
    race_data = results.all()

    races = [
        RaceHistory(
            year=row.year,
            round=row.round,
            race_name=row.event_name,
            position=row.position,
            points=float(row.points) if row.points is not None else None,
            team_name=row.team_name,
            team_color=row.team_color,
            status=row.status,
        )
        for row in race_data
    ]

    return DriverRaceHistoryResponse(
        driver_code=driver.driver_code,
        full_name=driver.full_name,
        races=races,
        available_years=available_years,
    )
