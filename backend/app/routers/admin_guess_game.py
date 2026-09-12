"""Admin-only Guess Game editorial queue routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_admin
from app.database import get_db
from app.models import User
from app.schemas.admin_guess_game import (
    AdminGuessPuzzleDateRequest,
    AdminGuessPuzzleDeleteResponse,
    AdminGuessPuzzleListResponse,
    AdminGuessPuzzleManualRequest,
    AdminGuessPuzzlePreviewResponse,
    AdminGuessPuzzleRandomizeRequest,
    AdminGuessPuzzleRandomizeResponse,
    AdminGuessPuzzleStatusResponse,
)
from app.schemas.daily_grid import GameDriverCatalogResponse
from app.services.admin_guess_game_service import (
    GUESS_SCHEDULE,
    AdminGuessGameService,
)

router = APIRouter()


def _status(puzzle) -> AdminGuessPuzzleStatusResponse:
    return AdminGuessPuzzleStatusResponse(
        number=puzzle.number,
        status=puzzle.status,
        published_on=puzzle.published_on,
        reviewed_at=puzzle.reviewed_at,
        reviewed_by_id=puzzle.reviewed_by_id,
    )


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
    """A chosen driver, appended to the upcoming run."""
    try:
        return _status(await AdminGuessGameService.add_manual(db, request, admin.id))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/{number}/preview", response_model=AdminGuessPuzzlePreviewResponse)
async def preview_guess_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """The winning row and the closest decoys, as the game would draw them."""
    try:
        return await AdminGuessGameService.preview(db, number)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.put("/{number}/approve", response_model=AdminGuessPuzzleStatusResponse)
async def approve_guess_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Append the puzzle to the upcoming run."""
    try:
        return _status(await GUESS_SCHEDULE.approve(db, number, admin.id))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{number}/date", response_model=AdminGuessPuzzleStatusResponse)
async def move_guess_puzzle(
    number: int,
    request: AdminGuessPuzzleDateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Put the puzzle on a day; the upcoming run closes up around it."""
    try:
        return _status(
            await GUESS_SCHEDULE.move(db, number, request.published_on, admin.id)
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{number}/revert", response_model=AdminGuessPuzzleStatusResponse)
async def revert_guess_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        return _status(await GUESS_SCHEDULE.unschedule(db, number))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/drafts", response_model=AdminGuessPuzzleDeleteResponse)
async def delete_guess_drafts(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    return AdminGuessPuzzleDeleteResponse(
        deleted=await GUESS_SCHEDULE.delete_drafts(db)
    )


@router.delete("/{number}", status_code=204)
async def delete_guess_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        await GUESS_SCHEDULE.delete(db, number)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
