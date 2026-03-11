"""
User Model

Represents an authenticated user of the lapwise.dev platform.
"""

import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class UserRole(str, enum.Enum):
    user = "user"
    moderator = "moderator"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String(20), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.user, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    avatar_url = Column(String, nullable=True)
    bio = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    refresh_tokens = relationship("RefreshToken", back_populates="user")
    email_verification_tokens = relationship(
        "EmailVerificationToken", back_populates="user"
    )
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")
    login_history = relationship("LoginHistory", back_populates="user")

    def __repr__(self):
        return f"<User {self.username} ({self.email})>"
