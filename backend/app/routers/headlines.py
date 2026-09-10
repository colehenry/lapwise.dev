"""HTTP routes for the homepage ticker."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.headlines import HeadlinesResponse
from app.security import verify_api_key
from app.services.headlines import HeadlinesService

router = APIRouter()


@router.get("", response_model=HeadlinesResponse)
async def get_headlines(
    season: int | None = Query(default=None, ge=1950, le=2100),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """
    Get the ticker's candidate pool for a season.

    Half of the catalogue needs every driver's full career history, so this is
    computed here rather than in the browser. The client selects, orders and
    shuffles from the pool; the pool itself changes only when a race finishes.
    """
    year = season or datetime.now(timezone.utc).year
    return await HeadlinesService.get_headlines(db, year)
