"""
Comment Schemas
"""

from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.post import PostAuthor


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
    post_id: int
    parent_comment_id: int | None
    body: str
    vote_count: int
    author: PostAuthor
    user_voted: bool = False
    replies: list["CommentResponse"] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommentListResponse(BaseModel):
    comments: list[CommentResponse]
    next_cursor: str | None = None
