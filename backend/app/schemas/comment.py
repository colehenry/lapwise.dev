"""
Comment Schemas
"""

from datetime import datetime

from pydantic import BaseModel, field_validator


class CommentAuthor(BaseModel):
    id: int
    username: str
    avatar_url: str | None
    role: str

    model_config = {"from_attributes": True}


class CreateCommentRequest(BaseModel):
    body: str
    parent_comment_id: int | None = None

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Comment cannot be empty")
        if len(v) > 10000:
            raise ValueError("Comment must be under 10,000 characters")
        return v


class UpdateCommentRequest(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Comment cannot be empty")
        if len(v) > 10000:
            raise ValueError("Comment must be under 10,000 characters")
        return v


class CommentResponse(BaseModel):
    id: int
    thread_id: int
    parent_comment_id: int | None
    body: str
    vote_count: int
    author: CommentAuthor
    user_voted: bool = False
    replies: list["CommentResponse"] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RaceCommentsResponse(BaseModel):
    comments: list[CommentResponse]
    next_cursor: str | None = None
    comment_count: int = 0
    is_locked: bool = False


class UserCommentListItem(BaseModel):
    id: int
    body: str
    vote_count: int
    year: int
    round: int
    created_at: datetime


class ThreadLockRequest(BaseModel):
    is_locked: bool
