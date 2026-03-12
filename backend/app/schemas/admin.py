"""
Admin Schemas

Pydantic models for admin panel request/response validation.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.auth import UserProfile


class AdminDashboardStats(BaseModel):
    user_count: int
    post_count: int
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
