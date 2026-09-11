"""Admin-only Guess Game editorial queue routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_admin
from app.database import get_db
from app.models import User
from app.schemas.admin_guess_game import (
    AdminGuessPuzzleDeleteResponse,
    AdminGuessPuzzleListResponse,
    AdminGuessPuzzleManualRequest,
    AdminGuessPuzzleRandomizeRequest,
    AdminGuessPuzzleRandomizeResponse,
    AdminGuessPuzzleScheduleRequest,
    AdminGuessPuzzleStatusResponse,
)
from app.schemas.daily_grid import GameDriverCatalogResponse
from app.services.admin_guess_game_service import AdminGuessGameService

router = APIRouter()


@router.get("/drivers/catalog", response_model=GameDriverCatalogResponse)
async def list_eligible_guess_drivers(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    return await AdminGuessGameService.catalog(db)


@router.get("", response_model=AdminGuessPuzzleListResponse)
async def list_guess_puzzles(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    return await AdminGuessGameService.list_puzzles(db)


@router.post("/randomize", response_model=AdminGuessPuzzleRandomizeResponse)
async def randomize_guess_puzzles(
    request: AdminGuessPuzzleRandomizeRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        return await AdminGuessGameService.randomize(db, request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/manual", response_model=AdminGuessPuzzleStatusResponse)
async def add_manual_guess_puzzle(
    request: AdminGuessPuzzleManualRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        return await AdminGuessGameService.add_manual(db, request, admin.id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{number}/approve", response_model=AdminGuessPuzzleStatusResponse)
async def approve_guess_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        return await AdminGuessGameService.approve(db, number, admin.id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{number}/schedule", response_model=AdminGuessPuzzleStatusResponse)
async def schedule_guess_puzzle(
    number: int,
    request: AdminGuessPuzzleScheduleRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        return await AdminGuessGameService.schedule(db, number, request, admin.id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{number}/revert", response_model=AdminGuessPuzzleStatusResponse)
async def revert_guess_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        return await AdminGuessGameService.revert(db, number)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/drafts", response_model=AdminGuessPuzzleDeleteResponse)
async def delete_guess_drafts(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    return AdminGuessPuzzleDeleteResponse(
        deleted=await AdminGuessGameService.delete_drafts(db)
    )


@router.delete("/{number}", status_code=204)
async def delete_guess_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        await AdminGuessGameService.delete(db, number)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
