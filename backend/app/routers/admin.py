"""
Admin Router

Endpoints for administrative tasks (user management, dashboard stats).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_admin
from app.models.user import User
from app.schemas.auth import UserProfile
from app.schemas.admin import (
    AdminDashboardStats,
    AdminUserListResponse,
    AdminUserUpdateRoleRequest,
    AdminUserUpdateStatusRequest,
    LoginHistoryResponse,
)
from app.services.user_service import UserService
from app.services.post_service import PostService

router = APIRouter()


@router.get("/dashboard", response_model=AdminDashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """
    Get high-level statistics for the admin dashboard.
    """
    user_count = await UserService.count_users(db)
    post_count = await PostService.count_posts(db)
    recent_activity_raw = await UserService.get_recent_login_activity(db, limit=10)

    # Format activity for the response
    recent_activity = []
    for item in recent_activity_raw:
        activity = {
            "id": item.id,
            "user_id": item.user_id,
            "username": item.user.username if item.user else None,
            "ip_address": item.ip_address,
            "user_agent": item.user_agent,
            "success": item.success,
            "created_at": item.created_at,
        }
        recent_activity.append(activity)

    return {
        "user_count": user_count,
        "post_count": post_count,
        "recent_activity": recent_activity,
    }


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    query: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """
    List users with pagination and search.
    """
    skip = (page - 1) * size
    users = await UserService.get_all_users(db, skip=skip, limit=size, query=query)
    total = await UserService.count_users(db, query=query)

    return {
        "users": [UserProfile.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "size": size,
    }


@router.put("/users/{user_id}/role", response_model=UserProfile)
async def update_user_role(
    user_id: int,
    data: AdminUserUpdateRoleRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Update a user's role.
    """
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    user = await UserService.update_user_role(db, user_id, data.role)
    if not user:
        raise HTTPException(status_code=404, detail="User not found or invalid role")

    return UserProfile.model_validate(user)


@router.put("/users/{user_id}/status", response_model=UserProfile)
async def update_user_status(
    user_id: int,
    data: AdminUserUpdateStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Activate or deactivate a user account.
    """
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=400, detail="Cannot change your own account status"
        )

    user = await UserService.update_user_status(db, user_id, data.is_active)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserProfile.model_validate(user)
