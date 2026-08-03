"""
Admin Schemas

Pydantic models for admin panel request/response validation.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.auth import UserProfile
from app.schemas.comment import CommentAuthor


class AdminCommentListItem(BaseModel):
    id: int
    parent_comment_id: Optional[int] = None
    body: str
    vote_count: int
    author: CommentAuthor
    year: int
    round: int
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminCommentListResponse(BaseModel):
    comments: list[AdminCommentListItem]
    next_cursor: Optional[str] = None


class AdminDashboardStats(BaseModel):
    user_count: int
    active_users: int
    comment_count: int
    total_ai_queries: int
    recent_activity: list[dict]


class AdminUserListResponse(BaseModel):
    users: list[UserProfile]
    total: int
    page: int
    size: int


class AdminUserUpdateRoleRequest(BaseModel):
    role: str


class AdminUserUpdateStatusRequest(BaseModel):
    is_active: bool


class LoginHistoryResponse(BaseModel):
    id: int
    user_id: Optional[int]
    ip_address: str
    user_agent: Optional[str]
    success: bool
    failure_reason: Optional[str]
    created_at: datetime
    username: Optional[str] = None  # To display username in the list

    class Config:
        from_attributes = True
