from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import UserPublicProfile
from app.services.user_service import UserService

router = APIRouter()

@router.get("/{username}", response_model=UserPublicProfile)
async def get_user_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get public profile data for a user by username.
    """
    user = await UserService.get_user_by_username(db, username)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return UserPublicProfile.model_validate(user)
