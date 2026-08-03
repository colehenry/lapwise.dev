"""Race-weekend availability endpoint."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.weekend import RoundAvailabilityResponse
from app.security import verify_api_key
from app.services.weekend_service import WeekendService

router = APIRouter()


@router.get("/{season}/{round}/availability", response_model=RoundAvailabilityResponse)
async def get_round_availability(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get which sessions a race weekend has, without results or lap data.

    Lets the weekend page load one active session instead of requesting every
    session type to discover which tabs exist.
    """
    availability = await WeekendService.get_round_availability(db, season, round)

    if not availability:
        raise HTTPException(
            status_code=404,
            detail=f"No sessions found for season {season}, round {round}",
        )

    return availability
