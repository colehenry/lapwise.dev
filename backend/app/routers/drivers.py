"""
Drivers Router

API endpoints for driver profiles and statistics.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.services.driver_service import DriverService
from app.schemas.driver import (
    DriverProfileResponse,
    DriverSeasonHistoryResponse,
    DriverRaceHistoryResponse,
)
from app.security import verify_api_key

router = APIRouter()


@router.get("/{driver_code}", response_model=DriverProfileResponse)
async def get_driver_profile(
    driver_code: str,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
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
    driver_profile = await DriverService.get_driver_profile(db, driver_code)

    if not driver_profile:
        raise HTTPException(
            status_code=404, detail=f"Driver with code '{driver_code}' not found"
        )

    return driver_profile


@router.get("/{driver_code}/season-history", response_model=DriverSeasonHistoryResponse)
async def get_driver_season_history(
    driver_code: str,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
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
    history = await DriverService.get_season_history(db, driver_code)

    if not history:
        raise HTTPException(
            status_code=404, detail=f"Driver with code '{driver_code}' not found"
        )

    return history


@router.get("/{driver_code}/race-history", response_model=DriverRaceHistoryResponse)
async def get_driver_race_history(
    driver_code: str,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
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
    try:
        history = await DriverService.get_race_history(
            db, driver_code, start_year, end_year
        )
    except ValueError as e:
         raise HTTPException(status_code=400, detail=str(e))

    if not history:
        raise HTTPException(
            status_code=404, detail=f"Driver with code '{driver_code}' not found"
        )

    return history
