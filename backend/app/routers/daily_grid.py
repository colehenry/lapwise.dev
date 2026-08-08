"""HTTP routes for the daily Lapwise Grid."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.daily_grid import (
    DailyGameResponse,
    GameDriverCatalogResponse,
    GameDriverSearchResponse,
    GameGuessRequest,
    GameGuessResponse,
    RookieOptionsResponse,
)
from app.security import verify_api_key
from app.services.daily_grid_service import DailyGridService

router = APIRouter()


@router.get("", response_model=DailyGameResponse)
async def get_daily_game(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await DailyGridService.puzzle(db)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Grid not found") from error


@router.get("/drivers", response_model=GameDriverSearchResponse)
async def search_game_drivers(
    q: str = Query(min_length=2, max_length=80),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    return await DailyGridService.search_drivers(db, q)


@router.get("/drivers/catalog", response_model=GameDriverCatalogResponse)
async def get_game_driver_catalog(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    return await DailyGridService.driver_catalog(db)


@router.get("/{puzzle_number}", response_model=DailyGameResponse)
async def get_game(
    puzzle_number: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await DailyGridService.puzzle(db, puzzle_number)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Grid not found") from error


@router.get("/{puzzle_number}/rookie-options", response_model=RookieOptionsResponse)
async def get_rookie_options(
    puzzle_number: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await DailyGridService.rookie_options(db, puzzle_number)
    except ValueError as error:
        raise HTTPException(
            status_code=404, detail="Rookie options not found"
        ) from error


@router.post("/guess", response_model=GameGuessResponse)
async def submit_game_guess(
    guess: GameGuessRequest,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    try:
        result = await DailyGridService.submit_guess(
            db,
            puzzle_id=guess.puzzle_id,
            row_id=guess.row_id,
            column_id=guess.column_id,
            driver_slug=guess.driver_slug,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if result is None:
        raise HTTPException(status_code=404, detail="Driver not found")
    return result
