"""
Posts Router

Endpoints for discussion posts, comments, and votes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_active_user, get_current_admin, get_optional_user
from app.models.user import User
from app.schemas.post import (
    CreatePostRequest,
    UpdatePostRequest,
    PostResponse,
    PostListResponse,
)
from app.schemas.comment import (
    CreateCommentRequest,
    UpdateCommentRequest,
    CommentResponse,
    CommentListResponse,
)
from app.services.post_service import PostService
from app.services.comment_service import CommentService
from app.services.vote_service import VoteService

router = APIRouter()


# --- Posts ---


@router.get("", response_model=PostListResponse)
async def list_posts(
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    sort: str = Query("new", pattern="^(new|top)$"),
    tag: str | None = Query(None, description="Filter by tag slug"),
    post_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await PostService.get_posts(
        db,
        cursor=cursor,
        limit=limit,
        sort=sort,
        tag_slug=tag,
        post_type=post_type,
        current_user_id=current_user.id if current_user else None,
    )
    return result


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    data: CreatePostRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Only admins can create news/weekly_recap
    if data.post_type in ("news", "weekly_recap"):
        if current_user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can create this post type",
            )

    post = await PostService.create_post(
        db,
        author_id=current_user.id,
        title=data.title,
        body=data.body,
        post_type=data.post_type,
        tag_ids=data.tag_ids,
    )

    return await PostService.get_post(db, post.id, current_user.id)


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    post = await PostService.get_post(
        db, post_id, current_user.id if current_user else None
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: int,
    data: UpdatePostRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        is_admin = current_user.role.value == "admin"
        post = await PostService.update_post(
            db,
            post_id,
            current_user.id,
            is_admin,
            title=data.title,
            body=data.body,
            tag_ids=data.tag_ids,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    return await PostService.get_post(db, post.id, current_user.id)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        is_admin = current_user.role.value == "admin"
        deleted = await PostService.delete_post(db, post_id, current_user.id, is_admin)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not deleted:
        raise HTTPException(status_code=404, detail="Post not found")


@router.post("/{post_id}/pin", status_code=status.HTTP_200_OK)
async def pin_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    post = await PostService.pin_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"is_pinned": post.is_pinned}


@router.post("/{post_id}/lock", status_code=status.HTTP_200_OK)
async def lock_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    post = await PostService.lock_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"is_locked": post.is_locked}


# --- Comments ---


@router.get("/{post_id}/comments", response_model=CommentListResponse)
async def list_comments(
    post_id: int,
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await CommentService.get_comments(
        db,
        post_id,
        cursor=cursor,
        limit=limit,
        current_user_id=current_user.id if current_user else None,
    )
    return result


@router.post(
    "/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    post_id: int,
    data: CreateCommentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        comment = await CommentService.create_comment(
            db,
            post_id=post_id,
            author_id=current_user.id,
            body=data.body,
            parent_comment_id=data.parent_comment_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "parent_comment_id": comment.parent_comment_id,
        "body": comment.body,
        "vote_count": comment.vote_count,
        "author": comment.author,
        "user_voted": False,
        "replies": [],
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    }


# --- Comment edit/delete (flat routes) ---


@router.put("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int,
    data: UpdateCommentRequest,
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

    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "parent_comment_id": comment.parent_comment_id,
        "body": comment.body,
        "vote_count": comment.vote_count,
        "author": comment.author,
        "user_voted": False,
        "replies": [],
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    }


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
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


# --- Votes ---


@router.post("/{post_id}/vote")
async def vote_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        result = await VoteService.toggle_post_vote(db, current_user.id, post_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


@router.post("/comments/{comment_id}/vote")
async def vote_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        result = await VoteService.toggle_comment_vote(db, current_user.id, comment_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result
