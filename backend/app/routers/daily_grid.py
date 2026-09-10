"""HTTP routes for the daily Lapwise Grid."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_optional_user
from app.database import get_db
from app.models import User
from app.schemas.daily_games import (
    DailyGameLeaderboardResponse,
    DailyGamePersonalStats,
)
from app.schemas.daily_grid import (
    DailyGameResponse,
    DailySummaryResponse,
    GameDriverCatalogResponse,
    GameDriverSearchResponse,
    GameGuessRequest,
    GameGuessResponse,
    GridRetireResponse,
    GridSessionRequest,
    GridSessionResponse,
    RookieOptionsResponse,
)
from app.security import verify_api_key
from app.services.daily_grid_service import DailyGridService
from app.services.daily_grid_session_service import DailyGridSessionService

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


@router.get("/summary", response_model=DailySummaryResponse)
async def get_daily_summary(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get the homepage grid card: the board's shape, never its headers.

    Compatibility endpoint. Viewer state now comes from ``/api/games/summary``
    and personal results from ``/api/daily/stats``.
    """
    try:
        return await DailyGridService.summary(db)
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


@router.post("/sessions", response_model=GridSessionResponse)
async def create_or_restore_grid_session(
    request: GridSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await DailyGridSessionService.create_or_restore(
            db,
            request.puzzle_id,
            request.mode,
            current_user.id if current_user else None,
            request.anon_id,
            request.ranked,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/sessions/{session_id}/retire", response_model=GridRetireResponse)
async def retire_grid_session(
    session_id: UUID,
    anon_id: str | None = Query(default=None, min_length=16, max_length=64),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    api_key: str = Depends(verify_api_key),
):
    try:
        await DailyGridSessionService.retire(
            db,
            session_id,
            current_user.id if current_user else None,
            anon_id,
        )
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return GridRetireResponse(status="retired")


@router.get("/stats", response_model=DailyGamePersonalStats)
async def get_grid_stats(
    mode: str = Query(default="standard", pattern="^(standard|rookie)$"),
    anon_id: str | None = Query(default=None, min_length=16, max_length=64),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await DailyGridSessionService.stats(
            db, mode, current_user.id if current_user else None, anon_id
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/leaderboard", response_model=DailyGameLeaderboardResponse)
async def get_grid_leaderboard(
    puzzle_id: str = Query(min_length=1, max_length=40),
    mode: str = Query(default="standard", pattern="^(standard|rookie)$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await DailyGridSessionService.leaderboard(
            db, puzzle_id, mode, offset, limit
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


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
    current_user: User | None = Depends(get_optional_user),
    api_key: str = Depends(verify_api_key),
):
    try:
        result = await DailyGridService.submit_guess(
            db,
            puzzle_id=guess.puzzle_id,
            row_id=guess.row_id,
            column_id=guess.column_id,
            driver_slug=guess.driver_slug,
            session_id=guess.session_id,
            user_id=current_user.id if current_user else None,
            anon_id=guess.anon_id,
        )
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if result is None:
        raise HTTPException(status_code=404, detail="Driver not found")
    return result
