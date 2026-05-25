"""
Admin Router

Endpoints for administrative tasks (user management, dashboard stats).
"""

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
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
    AdminPostListItem,
    AdminPostListResponse,
    AdminCommentListItem,
)
from app.services.user_service import UserService
from app.services.post_service import PostService
from app.services.comment_service import CommentService

router = APIRouter()

PERIOD_HOURS: dict[str, int | None] = {
    "all": None,
    "month": 24 * 30,
    "week": 24 * 7,
    "24h": 24,
}


def _since(period: str) -> datetime | None:
    hours = PERIOD_HOURS.get(period)
    if hours is None:
        return None
    return datetime.now(timezone.utc) - timedelta(hours=hours)


@router.get("/dashboard", response_model=AdminDashboardStats)
async def get_dashboard_stats(
    period: Literal["all", "month", "week", "24h"] = Query("all"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    since = _since(period)
    user_count = await UserService.count_users(db, since=since)
    active_users = await UserService.count_active_users(db, since=since)
    post_count = await PostService.count_posts(db, since=since)
    total_ai_queries = await UserService.sum_ai_queries(db)
    recent_activity_raw = await UserService.get_recent_login_activity(db, limit=10)

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
        "active_users": active_users,
        "post_count": post_count,
        "total_ai_queries": total_ai_queries,
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


@router.get("/posts", response_model=AdminPostListResponse)
async def list_posts_admin(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    query: str | None = None,
    status: str = Query("all", pattern="^(all|active|removed)$"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    skip = (page - 1) * size
    result = await PostService.get_admin_posts(
        db, skip=skip, limit=size, query=query, status=status
    )
    posts = [AdminPostListItem.model_validate(p) for p in result["posts"]]
    return {"posts": posts, "total": result["total"], "page": page, "size": size}


@router.delete("/posts/{post_id}", status_code=204)
async def admin_delete_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    deleted = await PostService.delete_post(db, post_id, current_admin.id, is_admin=True)
    if not deleted:
        raise HTTPException(status_code=404, detail="Post not found")


@router.put("/posts/{post_id}/restore")
async def admin_restore_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    post = await PostService.restore_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"id": post.id, "deleted_at": post.deleted_at}


@router.get("/posts/{post_id}/comments", response_model=list[AdminCommentListItem])
async def list_post_comments_admin(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    items = await CommentService.get_admin_comments(db, post_id, include_deleted=True)
    return [AdminCommentListItem.model_validate(c) for c in items]


@router.delete("/comments/{comment_id}", status_code=204)
async def admin_delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    deleted = await CommentService.delete_comment(
        db, comment_id, current_admin.id, is_admin=True
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Comment not found")


@router.put("/comments/{comment_id}/restore")
async def admin_restore_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    comment = await CommentService.restore_comment(db, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"id": comment.id, "deleted_at": comment.deleted_at}


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
