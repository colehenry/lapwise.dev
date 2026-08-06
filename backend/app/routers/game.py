"""HTTP routes for the daily Lapwise Grid."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.game import (
    DailyGameResponse,
    GameDriverSearchResponse,
    GameGuessRequest,
    GameGuessResponse,
)
from app.security import verify_api_key
from app.services.game_service import GameService

router = APIRouter()


@router.get("/daily", response_model=DailyGameResponse)
async def get_daily_game(api_key: str = Depends(verify_api_key)):
    return GameService.daily_puzzle()


@router.get("/drivers", response_model=GameDriverSearchResponse)
async def search_game_drivers(
    q: str = Query(min_length=2, max_length=80),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    return await GameService.search_drivers(db, q)


@router.post("/daily/guess", response_model=GameGuessResponse)
async def submit_game_guess(
    guess: GameGuessRequest,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    try:
        result = await GameService.submit_guess(
            db,
            row_id=guess.row_id,
            column_id=guess.column_id,
            driver_slug=guess.driver_slug,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if result is None:
        raise HTTPException(status_code=404, detail="Driver not found")
    return result
