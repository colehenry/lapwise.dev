"""
User Service

CRUD operations and business logic for user accounts.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.driver import Driver
from app.models.team import Team
from app.schemas.auth import (
    FavoriteDriverResponse,
    FavoriteTeamResponse,
    FavoriteCircuitResponse,
)
from app.models.circuit import Circuit
from app.models.email_verification_token import EmailVerificationToken
from app.models.password_reset_token import PasswordResetToken
from app.services.auth_service import AuthService


class UserService:
    @staticmethod
    async def create_user(
        db: AsyncSession,
        email: str,
        username: str,
        password: str,
    ) -> User:
        hashed = AuthService.hash_password(password)
        user = User(
            email=email.lower().strip(),
            username=username.lower().strip(),
            hashed_password=hashed,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
        result = await db.execute(
            select(User).where(User.email == email.lower().strip())
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
        result = await db.execute(
            select(User).where(User.username == username.lower().strip())
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_email_or_username(
        db: AsyncSession, identifier: str
    ) -> User | None:
        identifier = identifier.lower().strip()
        result = await db.execute(
            select(User).where(
                or_(User.email == identifier, User.username == identifier)
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all_users(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 20,
        query: str | None = None,
    ) -> list[User]:
        stmt = select(User)
        if query:
            stmt = stmt.where(
                or_(
                    User.username.ilike(f"%{query}%"),
                    User.email.ilike(f"%{query}%"),
                )
            )
        stmt = stmt.offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def count_users(
        db: AsyncSession,
        query: str | None = None,
        since: datetime | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(User)
        if query:
            stmt = stmt.where(
                or_(
                    User.username.ilike(f"%{query}%"),
                    User.email.ilike(f"%{query}%"),
                )
            )
        if since:
            stmt = stmt.where(User.created_at >= since)
        result = await db.execute(stmt)
        return result.scalar() or 0

    @staticmethod
    async def count_active_users(
        db: AsyncSession, since: datetime | None = None
    ) -> int:
        from app.models.login_history import LoginHistory

        stmt = select(func.count(func.distinct(LoginHistory.user_id))).where(
            LoginHistory.success.is_(True)
        )
        if since:
            stmt = stmt.where(LoginHistory.created_at >= since)
        result = await db.execute(stmt)
        return result.scalar() or 0

    @staticmethod
    async def get_recent_login_activity(db: AsyncSession, limit: int = 5) -> list[dict]:
        from app.models.login_history import LoginHistory

        stmt = (
            select(LoginHistory)
            .options(selectinload(LoginHistory.user))
            .order_by(LoginHistory.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        history = result.scalars().all()
        return history

    @staticmethod
    async def sum_ai_queries(db: AsyncSession) -> int:
        stmt = select(func.sum(User.ai_queries_used))
        result = await db.execute(stmt)
        return result.scalar() or 0

    @staticmethod
    async def update_user_role(
        db: AsyncSession, user_id: int, new_role: str
    ) -> User | None:
        user = await UserService.get_user_by_id(db, user_id)
        if not user:
            return None
        from app.models.user import UserRole

        try:
            user.role = UserRole(new_role)
        except ValueError:
            return None
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def update_user_status(
        db: AsyncSession, user_id: int, is_active: bool
    ) -> User | None:
        user = await UserService.get_user_by_id(db, user_id)
        if not user:
            return None
        user.is_active = is_active
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def update_user_profile(
        db: AsyncSession, user_id: int, updates: dict
    ) -> User | None:
        user = await UserService.get_user_by_id(db, user_id)
        if not user:
            return None
        for key, value in updates.items():
            if hasattr(user, key) and key not in (
                "id",
                "email",
                "hashed_password",
                "role",
                "created_at",
            ):
                setattr(user, key, value)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def change_password(
        db: AsyncSession,
        user_id: int,
        old_password: str | None,
        new_password: str,
    ) -> bool:
        """Set or change a user's password.

        For OAuth-only users (hashed_password is None) the old_password is
        ignored — they're setting an initial password so they can disconnect
        the OAuth provider later. For users who already have a password, the
        old one must verify.
        """
        user = await UserService.get_user_by_id(db, user_id)
        if not user:
            return False
        if user.hashed_password is not None:
            if not old_password or not AuthService.verify_password(
                old_password, user.hashed_password
            ):
                return False
        user.hashed_password = AuthService.hash_password(new_password)
        await db.commit()
        return True

    @staticmethod
    async def resolve_user_favorites(db: AsyncSession, user: User) -> dict:
        """Resolve raw favorite IDs/names into rich display objects."""
        result = {}

        if user.favorite_driver_id:
            driver = await db.execute(
                select(Driver).where(Driver.id == user.favorite_driver_id)
            )
            d = driver.scalar_one_or_none()
            if d:
                # Get headshot from most recent session result
                from app.models.session_result import SessionResult

                sr = await db.execute(
                    select(SessionResult.headshot_url)
                    .where(SessionResult.driver_id == d.id)
                    .where(SessionResult.headshot_url.isnot(None))
                    .order_by(SessionResult.id.desc())
                    .limit(1)
                )
                headshot = sr.scalar_one_or_none()
                result["favorite_driver"] = FavoriteDriverResponse(
                    driver_code=d.driver_code,
                    driver_slug=d.driver_slug,
                    full_name=d.full_name,
                    headshot_url=headshot,
                    country_code=d.country_code,
                )

        if user.favorite_team_name:
            team = await db.execute(
                select(Team)
                .where(Team.name == user.favorite_team_name)
                .order_by(Team.year.desc())
                .limit(1)
            )
            t = team.scalar_one_or_none()
            if t:
                result["favorite_team"] = FavoriteTeamResponse(
                    team_name=t.name,
                    team_color=t.team_color,
                    logo_url=t.logo_url,
                )

        if user.favorite_circuit_id:
            circuit = await db.execute(
                select(Circuit).where(Circuit.id == user.favorite_circuit_id)
            )
            c = circuit.scalar_one_or_none()
            if c:
                result["favorite_circuit"] = FavoriteCircuitResponse(
                    circuit_id=c.id,
                    name=c.name,
                    location=c.location,
                    country=c.country,
                )

        return result

    # --- Email Verification ---

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    async def create_email_verification_token(db: AsyncSession, user_id: int) -> str:
        token = secrets.token_urlsafe(48)
        token_hash = UserService._hash_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        evt = EmailVerificationToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(evt)
        await db.commit()
        return token

    @staticmethod
    async def verify_email(db: AsyncSession, token: str) -> bool:
        token_hash = UserService._hash_token(token)
        result = await db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.token_hash == token_hash,
                EmailVerificationToken.used_at.is_(None),
                EmailVerificationToken.expires_at > datetime.now(timezone.utc),
            )
        )
        evt = result.scalar_one_or_none()
        if not evt:
            return False

        evt.used_at = datetime.now(timezone.utc)

        user = await UserService.get_user_by_id(db, evt.user_id)
        if user:
            user.email_verified = True

        await db.commit()
        return True

    # --- Password Reset ---

    @staticmethod
    async def create_password_reset_token(db: AsyncSession, email: str) -> str | None:
        """Returns a reset token if user exists, None otherwise.
        Callers should always return a success message regardless."""
        user = await UserService.get_user_by_email(db, email)
        if not user:
            return None

        token = secrets.token_urlsafe(48)
        token_hash = UserService._hash_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        prt = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(prt)
        await db.commit()
        return token

    @staticmethod
    async def reset_password(db: AsyncSession, token: str, new_password: str) -> bool:
        token_hash = UserService._hash_token(token)
        result = await db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > datetime.now(timezone.utc),
            )
        )
        prt = result.scalar_one_or_none()
        if not prt:
            return False

        prt.used_at = datetime.now(timezone.utc)

        user = await UserService.get_user_by_id(db, prt.user_id)
        if user:
            user.hashed_password = AuthService.hash_password(new_password)

        await db.commit()
        return True
