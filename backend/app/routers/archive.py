"""HTTP routes for archive-wide figures."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.archive import ArchiveCountsResponse
from app.security import verify_api_key
from app.services.archive_aggregate_service import ArchiveAggregateService

router = APIRouter()


@router.get("/counts", response_model=ArchiveCountsResponse)
async def get_archive_counts(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """
    Get how many drivers, constructors, circuits and races the archive holds.

    The entry tiles show four numbers; without this they cost every row of
    three listings to render.
    """
    return await ArchiveAggregateService.counts(db)
