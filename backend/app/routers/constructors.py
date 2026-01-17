"""
Constructors Router

API endpoints for constructor/team profiles and statistics.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional

from app.database import get_db
from app.models import Team, SessionResult, Session, Driver
from app.schemas.constructor import (
    ConstructorProfileResponse,
    ConstructorSeasonHistoryResponse,
    ConstructorSeasonHistory,
    ConstructorRaceHistoryResponse,
    ConstructorRaceHistory,
)
from app.security import verify_api_key

router = APIRouter()


@router.get("/{team_name}", response_model=ConstructorProfileResponse)
async def get_constructor_profile(
    team_name: str,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get complete constructor profile with career statistics.

    Returns team information and calculated career stats including:
    - Total seasons, races, wins, podiums
    - Best finish position
    - Total championship points

    Args:
        team_name: Team name (e.g., "Red Bull Racing", "Ferrari")
    """

    # Normalize team name (replace URL-safe characters)
    team_name_normalized = team_name.replace("-", " ")

    # Get team basic info (from most recent season)
    team_query = (
        select(Team)
        .where(func.lower(Team.name) == team_name_normalized.lower())
        .order_by(Team.year.desc())
        .limit(1)
    )
    team_result = await db.execute(team_query)
    team = team_result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=404, detail=f"Constructor '{team_name}' not found"
        )

    # ========================================================================
    # Calculate Career Statistics
    # ========================================================================

    # Get all teams with this name across years
    all_teams_query = select(Team.id).where(
        func.lower(Team.name) == team_name_normalized.lower()
    )
    all_teams_result = await db.execute(all_teams_query)
    team_ids = [row[0] for row in all_teams_result.all()]

    # Get all race results for these teams (not qualifying or practice)
    race_results_query = (
        select(SessionResult, Session)
        .join(Session, SessionResult.session_id == Session.id)
        .where(SessionResult.team_id.in_(team_ids))
        .where(Session.session_type.in_(["race", "sprint_race"]))
        .order_by(Session.date.desc())
    )

    results = await db.execute(race_results_query)
    race_results = results.all()

    if not race_results:
        # Team exists but has no race results yet
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
    # Group by race to count unique races
    races_set = set()
    total_wins = 0
    total_podiums = 0
    total_points = 0.0
    best_finish = None

    for result, session in race_results:
        seasons.add(session.year)
        race_key = (session.year, session.round, session.session_type)
        races_set.add(race_key)

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

    total_races = len(races_set)

    # Calculate championships (seasons where team finished P1)
    total_championships = 0
    for year in seasons:
        # Get championship standings for this year
        standings_query = (
            select(Team.id, func.sum(SessionResult.points).label("total_points"))
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == year)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Team.id)
            .order_by(func.sum(SessionResult.points).desc())
            .limit(1)  # Only get the champion
        )

        standings_result = await db.execute(standings_query)
        champion = standings_result.first()

        if champion and champion.id in team_ids:
            total_championships += 1

    # Get latest season
    latest_season = max(seasons) if seasons else None

    return ConstructorProfileResponse(
        team_name=team.name,
        team_color=team.team_color,
        total_seasons=len(seasons),
        total_races=total_races,
        total_championships=total_championships,
        total_wins=total_wins,
        total_podiums=total_podiums,
        total_points=total_points,
        best_finish=best_finish,
        latest_season=latest_season,
    )


@router.get(
    "/{team_name}/season-history", response_model=ConstructorSeasonHistoryResponse
)
async def get_constructor_season_history(
    team_name: str,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get constructor's championship position and points for each season.

    Returns year-by-year breakdown of the constructor's career showing:
    - Championship position each season
    - Total points scored

    Args:
        team_name: Team name (e.g., "Red Bull Racing", "Ferrari")
    """

    # Normalize team name
    team_name_normalized = team_name.replace("-", " ")

    # Get team basic info
    team_query = (
        select(Team)
        .where(func.lower(Team.name) == team_name_normalized.lower())
        .order_by(Team.year.desc())
        .limit(1)
    )
    team_result = await db.execute(team_query)
    team = team_result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=404, detail=f"Constructor '{team_name}' not found"
        )

    # Get all teams with this name across years
    all_teams_query = select(Team.id, Team.year, Team.team_color).where(
        func.lower(Team.name) == team_name_normalized.lower()
    )
    all_teams_result = await db.execute(all_teams_query)
    team_data = {row.year: (row.id, row.team_color) for row in all_teams_result.all()}

    # Get all race results grouped by season
    race_results_query = (
        select(
            Session.year,
            func.sum(SessionResult.points).label("total_points"),
        )
        .join(Session, SessionResult.session_id == Session.id)
        .where(SessionResult.team_id.in_([tid for tid, _ in team_data.values()]))
        .where(Session.session_type.in_(["race", "sprint_race"]))
        .where(SessionResult.points.isnot(None))
        .group_by(Session.year)
        .order_by(Session.year)
    )

    results = await db.execute(race_results_query)
    season_data = results.all()

    if not season_data:
        # Team exists but has no race results
        return ConstructorSeasonHistoryResponse(
            team_name=team.name,
            seasons=[],
        )

    # For each season, calculate championship position
    seasons = []
    for season_row in season_data:
        year = season_row.year

        # Get championship standings for this year
        standings_query = (
            select(Team.id, func.sum(SessionResult.points).label("total_points"))
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == year)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Team.id)
            .order_by(func.sum(SessionResult.points).desc())
        )

        standings_result = await db.execute(standings_query)
        standings = standings_result.all()

        # Find team's position
        championship_position = None
        team_id_for_year = team_data.get(year, (None, None))[0]
        for idx, standing in enumerate(standings):
            if standing.id == team_id_for_year:
                championship_position = idx + 1
                break

        seasons.append(
            ConstructorSeasonHistory(
                year=year,
                championship_position=championship_position,
                total_points=float(season_row.total_points),
                team_color=team_data.get(year, (None, None))[1],
            )
        )

    return ConstructorSeasonHistoryResponse(
        team_name=team.name,
        seasons=seasons,
    )


@router.get("/{team_name}/race-history", response_model=ConstructorRaceHistoryResponse)
async def get_constructor_race_history(
    team_name: str,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get constructor's race-by-race results across their career.

    Returns individual race results with best position, total points, and driver info.
    Can be filtered by year range (max 5 years).

    Args:
        team_name: Team name (e.g., "Red Bull Racing", "Ferrari")
        start_year: Starting year (optional, defaults to last 5 years)
        end_year: Ending year (optional, defaults to most recent year)
    """

    # Normalize team name
    team_name_normalized = team_name.replace("-", " ")

    # Get team basic info
    team_query = (
        select(Team)
        .where(func.lower(Team.name) == team_name_normalized.lower())
        .order_by(Team.year.desc())
        .limit(1)
    )
    team_result = await db.execute(team_query)
    team = team_result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=404, detail=f"Constructor '{team_name}' not found"
        )

    # Get all teams with this name across years
    all_teams_query = select(Team.id, Team.year).where(
        func.lower(Team.name) == team_name_normalized.lower()
    )
    all_teams_result = await db.execute(all_teams_query)
    team_data = {row.year: row.id for row in all_teams_result.all()}

    # Get all available years for this team
    available_years = sorted(team_data.keys(), reverse=True)

    if not available_years:
        return ConstructorRaceHistoryResponse(
            team_name=team.name,
            races=[],
            available_years=[],
        )

    # Determine year range (default to last 5 years)
    if end_year is None:
        end_year = available_years[0]  # Most recent year
    if start_year is None:
        start_year = max(
            end_year - 4, available_years[-1]
        )  # 5 years or start of career

    # Validate range
    if end_year - start_year > 4:
        raise HTTPException(status_code=400, detail="Year range cannot exceed 5 years")

    # Get all race results in the year range grouped by race
    race_results_query = (
        select(
            Session.year,
            Session.round,
            Session.event_name,
            Session.date,
            SessionResult.position,
            SessionResult.points,
            Driver.full_name,
        )
        .join(SessionResult, Session.id == SessionResult.session_id)
        .join(Driver, SessionResult.driver_id == Driver.id)
        .where(SessionResult.team_id.in_(team_data.values()))
        .where(Session.session_type.in_(["race", "sprint_race"]))
        .where(Session.year >= start_year)
        .where(Session.year <= end_year)
        .order_by(Session.date, SessionResult.position)
    )

    results = await db.execute(race_results_query)
    race_data = results.all()

    # Group results by race
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
            {"name": row.full_name, "position": row.position}
        )
        if row.points is not None:
            races_dict[race_key]["total_points"] += float(row.points)

        if row.position is not None:
            if (
                races_dict[race_key]["best_position"] is None
                or row.position < races_dict[race_key]["best_position"]
            ):
                races_dict[race_key]["best_position"] = row.position

    # Convert to list format
    races = []
    for race_data_dict in races_dict.values():
        driver_1_name = (
            race_data_dict["drivers"][0]["name"]
            if len(race_data_dict["drivers"]) > 0
            else None
        )
        driver_1_position = (
            race_data_dict["drivers"][0]["position"]
            if len(race_data_dict["drivers"]) > 0
            else None
        )
        driver_2_name = (
            race_data_dict["drivers"][1]["name"]
            if len(race_data_dict["drivers"]) > 1
            else None
        )
        driver_2_position = (
            race_data_dict["drivers"][1]["position"]
            if len(race_data_dict["drivers"]) > 1
            else None
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
                driver_2_name=driver_2_name,
                driver_2_position=driver_2_position,
            )
        )

    return ConstructorRaceHistoryResponse(
        team_name=team.name,
        races=races,
        available_years=available_years,
    )
