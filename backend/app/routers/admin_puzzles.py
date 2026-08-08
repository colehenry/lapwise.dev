"""Editorial queue routes for the Daily Grid.

These return complete answer sets, so every route is admin-only. The player
contract in `daily_grid.py` deliberately never exposes an answer.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_admin
from app.database import get_db
from app.models.user import User
from app.schemas.admin_puzzle import (
    AdminPuzzleDetail,
    AdminPuzzleListResponse,
    PuzzleGenerateRequest,
    PuzzleGenerateResponse,
    PuzzleHeaderCatalogResponse,
    PuzzleScheduleRequest,
    PuzzleStatusResponse,
)
from app.services.admin_puzzle_service import AdminPuzzleService

router = APIRouter()


@router.get("/headers", response_model=PuzzleHeaderCatalogResponse)
async def list_headers(
    floor: int = Query(default=1990, ge=1950, le=2100),
    admin: User = Depends(get_current_admin),
):
    """Headers available to the generator, with the depth of each.

    Cached per floor after the first call, which is the slow one.
    """
    return await AdminPuzzleService.header_catalog(floor)


@router.post("/generate", response_model=PuzzleGenerateResponse)
async def generate_puzzles(
    request: PuzzleGenerateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Propose boards as drafts.

    Loading the driver pool and the header catalog dominates the cost, so a
    batch of ten runs in about the time one does. The request is synchronous
    and takes seconds.
    """
    return await AdminPuzzleService.generate(db, request)


@router.get("", response_model=AdminPuzzleListResponse)
async def list_puzzles(
    status: str | None = Query(default=None, pattern="^(draft|approved|published)$"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    return await AdminPuzzleService.list_puzzles(db, status)


@router.get("/{number}", response_model=AdminPuzzleDetail)
async def get_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        return await AdminPuzzleService.detail(db, number)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.put("/{number}/schedule", response_model=PuzzleStatusResponse)
async def schedule_puzzle(
    number: int,
    request: PuzzleScheduleRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        return await AdminPuzzleService.schedule(db, number, request, admin.id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{number}/revert", response_model=PuzzleStatusResponse)
async def revert_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        return await AdminPuzzleService.revert(db, number)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/{number}", status_code=204)
async def delete_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Remove a board. Allowed at any status until someone has played it."""
    try:
        await AdminPuzzleService.delete(db, number)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
