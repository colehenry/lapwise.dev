"""Thin HTTP routes for the guess game."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_optional_user
from app.database import get_db
from app.models import User
from app.schemas.guess_game import (
    GuessGameCatalogResponse,
    GuessGameGuessRequest,
    GuessGameGuessResponse,
    GuessGameLeaderboardResponse,
    GuessGamePuzzleResponse,
    GuessGameSessionRequest,
    GuessGameSessionResponse,
    GuessGameStatsResponse,
)
from app.security import verify_api_key
from app.services.guess_game_service import GuessGameService

router = APIRouter()


@router.get("", response_model=GuessGamePuzzleResponse)
async def get_guess_game(
    number: int | None = Query(default=None, ge=1),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await GuessGameService.puzzle(db, number)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/drivers/catalog", response_model=GuessGameCatalogResponse)
async def get_guess_game_catalog(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    return await GuessGameService.catalog(db)


@router.post(
    "/sessions",
    response_model=GuessGameSessionResponse,
    status_code=status.HTTP_200_OK,
)
async def create_or_restore_guess_session(
    request: GuessGameSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await GuessGameService.create_or_restore_session(
            db,
            request.puzzle_id,
            current_user.id if current_user else None,
            request.anon_id,
            request.ranked,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/guesses", response_model=GuessGameGuessResponse)
async def submit_guess_game_guess(
    request: GuessGameGuessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await GuessGameService.submit_guess(
            db,
            request.session_id,
            request.driver_slug,
            current_user.id if current_user else None,
            request.anon_id,
        )
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/stats", response_model=GuessGameStatsResponse)
async def get_guess_game_stats(
    anon_id: str | None = Query(default=None, min_length=16, max_length=64),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await GuessGameService.stats(
            db, current_user.id if current_user else None, anon_id
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/leaderboard", response_model=GuessGameLeaderboardResponse)
async def get_guess_game_leaderboard(
    puzzle_id: str = Query(min_length=1, max_length=40),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    try:
        return await GuessGameService.leaderboard(db, puzzle_id, offset, limit)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
