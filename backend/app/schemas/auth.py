"""
Auth Schemas

Pydantic models for authentication request/response validation.
"""

import re
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


RESERVED_USERNAMES = {
    "admin",
    "moderator",
    "lapwise",
    "system",
    "null",
    "undefined",
    "root",
    "superuser",
    "mod",
    "administrator",
    "support",
    "help",
    "api",
    "www",
}

USERNAME_REGEX = re.compile(r"^[a-z0-9_]{3,20}$")


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.lower().strip()
        if not USERNAME_REGEX.match(v):
            raise ValueError(
                "Username must be 3-20 characters, "
                "lowercase alphanumeric and underscores only"
            )
        if v in RESERVED_USERNAMES:
            raise ValueError("This username is reserved")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least 1 uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least 1 lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least 1 number")
        return v


class LoginRequest(BaseModel):
    identifier: str  # Email or username
    password: str


class UserProfile(BaseModel):
    id: int
    email: str
    username: str
    role: str
    email_verified: bool
    is_active: bool
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least 1 uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least 1 lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least 1 number")
        return v


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least 1 uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least 1 lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least 1 number")
        return v


class UserPublicProfile(BaseModel):
    username: str
    role: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class UsernameAvailabilityResponse(BaseModel):
    available: bool
    reason: Optional[str] = None


class SessionInfo(BaseModel):
    id: int
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    revoked_at: Optional[datetime] = None
    is_current: bool = False


class SessionsResponse(BaseModel):
    sessions: list[SessionInfo]


class DeleteAccountRequest(BaseModel):
    password: str
