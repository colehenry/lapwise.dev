"""
Comments Router

Endpoints for per-race comment threads and comment votes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_active_user, get_optional_user
from app.database import get_db
from app.limiter import limiter
from app.models.user import User
from app.schemas.comment import (
    CommentResponse,
    CreateCommentRequest,
    RaceCommentsResponse,
    UpdateCommentRequest,
    UserCommentListItem,
)
from app.services.comment_service import CommentService
from app.services.vote_service import VoteService

router = APIRouter()


def _serialize(comment) -> dict:
    return {
        "id": comment.id,
        "thread_id": comment.thread_id,
        "parent_comment_id": comment.parent_comment_id,
        "body": comment.body,
        "vote_count": comment.vote_count,
        "author": comment.author,
        "user_voted": False,
        "replies": [],
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    }


# --- Race threads ---


@router.get("/races/{year}/{round_num}", response_model=RaceCommentsResponse)
async def list_race_comments(
    year: int,
    round_num: int,
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    sort: str = Query("new", pattern="^(new|top)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    return await CommentService.get_comments(
        db,
        year,
        round_num,
        cursor=cursor,
        limit=limit,
        sort=sort,
        current_user_id=current_user.id if current_user else None,
    )


@router.post(
    "/races/{year}/{round_num}",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("12/minute")
async def create_race_comment(
    year: int,
    round_num: int,
    data: CreateCommentRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        comment = await CommentService.create_comment(
            db,
            year=year,
            round_num=round_num,
            author_id=current_user.id,
            body=data.body,
            parent_comment_id=data.parent_comment_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return _serialize(comment)


# --- Comments ---


@router.get("/users/{username}", response_model=list[UserCommentListItem])
async def list_user_comments(
    username: str,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await CommentService.get_user_comments(db, username, limit=limit)


@router.put("/{comment_id}", response_model=CommentResponse)
@limiter.limit("20/minute")
async def update_comment(
    comment_id: int,
    data: UpdateCommentRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        is_admin = current_user.role.value == "admin"
        comment = await CommentService.update_comment(
            db, comment_id, current_user.id, is_admin, data.body
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    return _serialize(comment)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_comment(
    comment_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        is_admin = current_user.role.value == "admin"
        deleted = await CommentService.delete_comment(
            db, comment_id, current_user.id, is_admin
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not deleted:
        raise HTTPException(status_code=404, detail="Comment not found")


@router.post("/{comment_id}/vote")
@limiter.limit("60/minute")
async def vote_comment(
    comment_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        result = await VoteService.toggle_comment_vote(db, current_user.id, comment_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result
