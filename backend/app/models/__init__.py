"""
Models package

This file imports all SQLAlchemy models so they can be easily imported elsewhere.
It also ensures all models are loaded before Alembic tries to detect them.

Usage:
    from app.models import Driver, Team, Circuit, Session, SessionResult
    from app.models import Lap, Weather, TrackStatus, RaceControlMessage
    from app.models import User, RefreshToken, EmailVerificationToken
    from app.models import PasswordResetToken, LoginHistory
    from app.models import RaceThread, Comment, Vote
"""

from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.models.archive_aggregate import AggConstructorCareer, AggDriverCareer
from app.models.championship import (
    ChampionshipClassificationException,
    ChampionshipScoringContext,
    ConstructorChampionshipStanding,
    DriverChampionshipStanding,
)
from app.models.circuit import Circuit
from app.models.comment import Comment
from app.models.driver import Driver
from app.models.email_verification_token import EmailVerificationToken
from app.models.game import GameSession, GameSessionGuess, Puzzle
from app.models.identity import (
    CircuitVenue,
    CircuitVenueExternalId,
    Constructor,
    ConstructorExternalId,
    DriverExternalId,
    DriverSeason,
    IngestIdentityIssue,
)
from app.models.lap import Lap
from app.models.login_history import LoginHistory
from app.models.media import DriverMediaAssignment, MediaAsset
from app.models.oauth_account import OAuthAccount
from app.models.password_reset_token import PasswordResetToken
from app.models.pit_stop import PitStop
from app.models.race_control_message import RaceControlMessage
from app.models.race_thread import RaceThread
from app.models.refresh_token import RefreshToken
from app.models.replay_data import ReplayData
from app.models.session import Session
from app.models.session_result import SessionResult
from app.models.session_summary import SessionSummary
from app.models.team import Team
from app.models.track_status import TrackStatus
from app.models.user import User, UserRole
from app.models.vote import Vote
from app.models.weather import Weather

# Export all models
__all__ = [
    "Driver",
    "MediaAsset",
    "DriverMediaAssignment",
    "DriverExternalId",
    "DriverSeason",
    "Constructor",
    "ConstructorExternalId",
    "Team",
    "AggConstructorCareer",
    "AggDriverCareer",
    "Circuit",
    "CircuitVenue",
    "CircuitVenueExternalId",
    "IngestIdentityIssue",
    "DriverChampionshipStanding",
    "ConstructorChampionshipStanding",
    "ChampionshipScoringContext",
    "ChampionshipClassificationException",
    "Session",
    "SessionResult",
    "Lap",
    "PitStop",
    "Weather",
    "TrackStatus",
    "RaceControlMessage",
    "User",
    "UserRole",
    "RefreshToken",
    "EmailVerificationToken",
    "PasswordResetToken",
    "LoginHistory",
    "OAuthAccount",
    "RaceThread",
    "Comment",
    "Vote",
    "AIConversation",
    "AIMessage",
    "ReplayData",
    "SessionSummary",
    "Puzzle",
    "GameSession",
    "GameSessionGuess",
]
