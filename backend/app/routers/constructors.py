"""
Constructors Router

API endpoints for constructor/team profiles and statistics.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.services.constructor_service import ConstructorService
from app.schemas.constructor import (
    ConstructorProfileResponse,
    ConstructorSeasonHistoryResponse,
    ConstructorRaceHistoryResponse,
    ConstructorListResponse,
)
from app.security import verify_api_key

router = APIRouter()


@router.get("/", response_model=ConstructorListResponse)
async def get_all_constructors(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get all-time constructor listing with career statistics.

    Returns all constructors who have participated in at least one race,
    ordered by total wins descending, then by total points descending.
    """
    return await ConstructorService.get_all_constructors(db)


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
    profile = await ConstructorService.get_constructor_profile(db, team_name)

    if not profile:
        raise HTTPException(
            status_code=404, detail=f"Constructor '{team_name}' not found"
        )

    return profile


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
    history = await ConstructorService.get_season_history(db, team_name)

    if not history:
        raise HTTPException(
            status_code=404, detail=f"Constructor '{team_name}' not found"
        )

    return history


@router.get("/{team_name}/race-history", response_model=ConstructorRaceHistoryResponse)
async def get_constructor_race_history(
    team_name: str,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    all: bool = False,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get constructor's race-by-race results across their career.

    Returns individual race results with best position, total points, and driver info.
    Can be filtered by year range (max 5 years), or use all=true for full history.

    Args:
        team_name: Team name (e.g., "Red Bull Racing", "Ferrari")
        start_year: Starting year (optional, defaults to last 5 years)
        end_year: Ending year (optional, defaults to most recent year)
        all: If true, return all races across entire history
    """
    try:
        history = await ConstructorService.get_race_history(
            db, team_name, start_year, end_year, fetch_all=all
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not history:
        raise HTTPException(
            status_code=404, detail=f"Constructor '{team_name}' not found"
        )

    return history
