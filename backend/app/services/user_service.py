"""
User Service

CRUD operations and business logic for user accounts.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.email_verification_token import EmailVerificationToken
from app.models.password_reset_token import PasswordResetToken
from app.services.auth_service import AuthService


class UserService:
    @staticmethod
    async def create_user(
        db: AsyncSession,
        email: str,
        username: str,
        display_name: str,
        password: str,
    ) -> User:
        hashed = AuthService.hash_password(password)
        user = User(
            email=email.lower().strip(),
            username=username.lower().strip(),
            display_name=display_name.strip(),
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
        db: AsyncSession, user_id: int, old_password: str, new_password: str
    ) -> bool:
        user = await UserService.get_user_by_id(db, user_id)
        if not user or not user.hashed_password:
            return False
        if not AuthService.verify_password(old_password, user.hashed_password):
            return False
        user.hashed_password = AuthService.hash_password(new_password)
        await db.commit()
        return True

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
