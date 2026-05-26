"""
Post Schemas
"""

from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.tag import TagResponse


class PostAuthor(BaseModel):
    id: int
    username: str
    avatar_url: str | None
    role: str

    model_config = {"from_attributes": True}


class CreatePostRequest(BaseModel):
    title: str
    body: str
    post_type: str = "discussion"
    tag_ids: list[int] = []

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1 or len(v) > 300:
            raise ValueError("Title must be 1-300 characters")
        return v

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Body cannot be empty")
        if len(v) > 50000:
            raise ValueError("Body must be under 50,000 characters")
        return v

    @field_validator("post_type")
    @classmethod
    def validate_post_type(cls, v: str) -> str:
        allowed = {"discussion", "analysis", "news", "weekly_recap"}
        if v not in allowed:
            raise ValueError(f"Post type must be one of: {', '.join(allowed)}")
        return v


class UpdatePostRequest(BaseModel):
    title: str | None = None
    body: str | None = None
    tag_ids: list[int] | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 1 or len(v) > 300:
                raise ValueError("Title must be 1-300 characters")
        return v

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 1:
                raise ValueError("Body cannot be empty")
            if len(v) > 50000:
                raise ValueError("Body must be under 50,000 characters")
        return v


class PostResponse(BaseModel):
    id: int
    title: str
    body: str
    post_type: str
    is_pinned: bool
    is_locked: bool
    vote_count: int
    comment_count: int
    author: PostAuthor
    tags: list[TagResponse]
    user_voted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PostListItem(BaseModel):
    id: int
    title: str
    body: str  # truncated in service
    post_type: str
    is_pinned: bool
    is_locked: bool
    vote_count: int
    comment_count: int
    author: PostAuthor
    tags: list[TagResponse]
    user_voted: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class PostListResponse(BaseModel):
    posts: list[PostListItem]
    next_cursor: str | None = None
