"""
Models package

This file imports all SQLAlchemy models so they can be easily imported elsewhere.
It also ensures all models are loaded before Alembic tries to detect them.

Usage:
    from app.models import Driver, Team, Circuit, Session, SessionResult
    from app.models import Lap, Weather, TrackStatus, RaceControlMessage
    from app.models import User, RefreshToken, EmailVerificationToken
    from app.models import PasswordResetToken, LoginHistory
    from app.models import Tag, Post, PostType, Comment, Vote
"""

from app.models.driver import Driver
from app.models.team import Team
from app.models.circuit import Circuit
from app.models.session import Session
from app.models.session_result import SessionResult
from app.models.lap import Lap
from app.models.weather import Weather
from app.models.track_status import TrackStatus
from app.models.race_control_message import RaceControlMessage
from app.models.user import User, UserRole
from app.models.refresh_token import RefreshToken
from app.models.email_verification_token import EmailVerificationToken
from app.models.password_reset_token import PasswordResetToken
from app.models.login_history import LoginHistory
from app.models.tag import Tag
from app.models.post import Post, PostType
from app.models.post_tag import post_tags  # noqa: F401
from app.models.comment import Comment
from app.models.vote import Vote

# Export all models
__all__ = [
    "Driver",
    "Team",
    "Circuit",
    "Session",
    "SessionResult",
    "Lap",
    "Weather",
    "TrackStatus",
    "RaceControlMessage",
    "User",
    "UserRole",
    "RefreshToken",
    "EmailVerificationToken",
    "PasswordResetToken",
    "LoginHistory",
    "Tag",
    "Post",
    "PostType",
    "Comment",
    "Vote",
]
