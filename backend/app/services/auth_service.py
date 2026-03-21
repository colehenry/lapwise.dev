"""
Auth Service

Core authentication logic: password hashing, JWT tokens, refresh tokens.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.refresh_token import RefreshToken
from app.models.login_history import LoginHistory

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    @staticmethod
    def create_access_token(user_id: int, role: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.access_token_expire_minutes
        )
        payload = {
            "sub": str(user_id),
            "role": role,
            "exp": expire,
            "type": "access",
        }
        return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)

    @staticmethod
    def create_refresh_token() -> str:
        return secrets.token_urlsafe(64)

    @staticmethod
    def decode_access_token(token: str) -> dict | None:
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
            if payload.get("type") != "access":
                return None
            return payload
        except JWTError:
            return None

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def hash_refresh_token(token: str) -> str:
        return AuthService._hash_token(token)

    @staticmethod
    async def store_refresh_token(
        db: AsyncSession,
        user_id: int,
        token: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        token_hash = AuthService._hash_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days
        )
        refresh = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            device_info=user_agent[:500] if user_agent else None,
            ip_address=ip_address,
            expires_at=expires_at,
        )
        db.add(refresh)
        await db.commit()

    @staticmethod
    async def validate_refresh_token(
        db: AsyncSession, token: str
    ) -> RefreshToken | None:
        token_hash = AuthService._hash_token(token)
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def revoke_refresh_token(db: AsyncSession, token: str) -> None:
        token_hash = AuthService._hash_token(token)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        refresh = result.scalar_one_or_none()
        if refresh:
            refresh.revoked_at = datetime.now(timezone.utc)
            await db.commit()

    @staticmethod
    async def revoke_all_user_tokens(db: AsyncSession, user_id: int) -> None:
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        tokens = result.scalars().all()
        now = datetime.now(timezone.utc)
        for t in tokens:
            t.revoked_at = now
        await db.commit()

    @staticmethod
    async def get_user_sessions(db: AsyncSession, user_id: int) -> list[RefreshToken]:
        """Get all valid (non-revoked, non-expired) sessions for a user."""
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > now,
            )
            .order_by(RefreshToken.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def revoke_user_session(
        db: AsyncSession, session_id: int, user_id: int
    ) -> RefreshToken | None:
        """Revoke a specific session. Returns the token if found, None otherwise."""
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.id == session_id,
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        session = result.scalar_one_or_none()
        if session:
            session.revoked_at = datetime.now(timezone.utc)
            await db.commit()
        return session

    @staticmethod
    async def check_login_rate_limit(
        db: AsyncSession,
        ip_address: str,
        window_minutes: int = 15,
        max_attempts: int = 10,
    ) -> bool:
        """Returns True if under the rate limit (allowed to attempt login)."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        result = await db.execute(
            select(func.count(LoginHistory.id)).where(
                LoginHistory.ip_address == ip_address,
                LoginHistory.success.is_(False),
                LoginHistory.created_at > cutoff,
            )
        )
        count = result.scalar()
        return count < max_attempts

    @staticmethod
    async def record_login_attempt(
        db: AsyncSession,
        user_id: int | None,
        ip_address: str,
        user_agent: str | None,
        success: bool,
        failure_reason: str | None = None,
    ) -> None:
        entry = LoginHistory(
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else None,
            success=success,
            failure_reason=failure_reason,
        )
        db.add(entry)
        await db.commit()
