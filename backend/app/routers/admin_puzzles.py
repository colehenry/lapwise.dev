"""Editorial routes for the Daily Grid.

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
    AdminPuzzleSummary,
    PuzzleDateRequest,
    PuzzleDeleteResponse,
    PuzzleGenerateRequest,
    PuzzleGenerateResponse,
    PuzzleHeaderCatalogResponse,
    PuzzleHeadersRequest,
    PuzzlePreviewResponse,
    PuzzleStatusResponse,
)
from app.services.admin_board_builder_service import (
    GRID_SCHEDULE,
    AdminBoardBuilderService,
)
from app.services.admin_puzzle_service import AdminPuzzleService

router = APIRouter()


def _status(puzzle) -> PuzzleStatusResponse:
    return PuzzleStatusResponse(
        number=puzzle.number,
        status=puzzle.status,
        published_on=puzzle.published_on,
        reviewed_at=puzzle.reviewed_at,
        reviewed_by_id=puzzle.reviewed_by_id,
    )


@router.get("/headers", response_model=PuzzleHeaderCatalogResponse)
async def list_headers(
    floor: int = Query(default=1990, ge=1950, le=2100),
    admin: User = Depends(get_current_admin),
):
    """Every header a board can use, with its depth. The first call at a
    floor builds the catalog and is slow; it is cached after that."""
    return await AdminPuzzleService.header_catalog(floor)


@router.post("/preview", response_model=PuzzlePreviewResponse)
async def preview_board(
    request: PuzzleHeadersRequest,
    admin: User = Depends(get_current_admin),
):
    """What a set of headers produces, without storing anything."""
    try:
        return await AdminBoardBuilderService.preview(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/generate", response_model=PuzzleGenerateResponse)
async def generate_puzzles(
    request: PuzzleGenerateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Propose boards as drafts. Synchronous and takes seconds."""
    return await AdminPuzzleService.generate(db, request)


@router.get("", response_model=AdminPuzzleListResponse)
async def list_puzzles(
    status: str | None = Query(default=None, pattern="^(draft|approved|published)$"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    return await AdminPuzzleService.list_puzzles(db, status)


@router.post("", response_model=AdminPuzzleSummary)
async def create_puzzle(
    request: PuzzleHeadersRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Store a hand-built board as a draft."""
    try:
        return await AdminBoardBuilderService.create(db, request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


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


@router.put("/{number}/headers", response_model=AdminPuzzleSummary)
async def replace_headers(
    number: int,
    request: PuzzleHeadersRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Rebuild an unplayed board from new headers, keeping its number."""
    try:
        return await AdminBoardBuilderService.replace_headers(db, number, request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{number}/approve", response_model=PuzzleStatusResponse)
async def approve_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Append the board to the upcoming run."""
    try:
        return _status(await GRID_SCHEDULE.approve(db, number, admin.id))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{number}/date", response_model=PuzzleStatusResponse)
async def move_puzzle(
    number: int,
    request: PuzzleDateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Put the board on a day; the upcoming run closes up around it."""
    try:
        return _status(
            await GRID_SCHEDULE.move(db, number, request.published_on, admin.id)
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{number}/revert", response_model=PuzzleStatusResponse)
async def revert_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        return _status(await GRID_SCHEDULE.unschedule(db, number))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/drafts", response_model=PuzzleDeleteResponse)
async def delete_all_drafts(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    return PuzzleDeleteResponse(deleted=await GRID_SCHEDULE.delete_drafts(db))


@router.delete("/{number}", status_code=204)
async def delete_puzzle(
    number: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Remove a board at any status until someone has played it."""
    try:
        await GRID_SCHEDULE.delete(db, number)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
