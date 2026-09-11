"""Daily Games hub endpoint."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_optional_user
from app.database import get_db
from app.models import User
from app.schemas.daily_games import DailyGamesSummaryResponse
from app.security import verify_api_key
from app.services.daily_games_service import DailyGamesService

router = APIRouter()


@router.get("/summary", response_model=DailyGamesSummaryResponse)
async def get_daily_games_summary(
    anon_id: str | None = Query(default=None, min_length=16, max_length=64),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    api_key: str = Depends(verify_api_key),
):
    return await DailyGamesService.summary(
        db, current_user.id if current_user else None, anon_id
    )
