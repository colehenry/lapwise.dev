"""
OAuth Service

Business logic for linking external OAuth identities (Google, etc.) to local
users, finding existing links, and creating new accounts from OAuth profiles.

The pending-signup token is a short-lived JWT used to carry OAuth profile data
between the callback step and the username-picker step. It is stored in an
httponly cookie and verified on completion.
"""

import re
from datetime import datetime, timedelta, timezone
from typing import Literal

from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.oauth_account import OAuthAccount
from app.models.user import User
from app.services.user_service import UserService

PENDING_SIGNUP_TTL_MINUTES = 10
PENDING_SIGNUP_TYPE = "oauth_pending_signup"
ALGORITHM = "HS256"

OAuthLinkStatus = Literal["existing", "linked", "needs_username"]


class OAuthService:
    @staticmethod
    async def find_or_link_user(
        db: AsyncSession,
        *,
        provider: str,
        provider_account_id: str,
        email: str,
    ) -> tuple[User | None, OAuthLinkStatus]:
        """
        Resolve an OAuth identity to a local user.

        Returns:
            (user, "existing")       — already linked, just sign in
            (user, "linked")         — found by email, link created, sign in
            (None,  "needs_username") — no match, caller must run signup flow
        """
        # 1. Already linked?
        result = await db.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == provider,
                OAuthAccount.provider_account_id == provider_account_id,
            )
        )
        link = result.scalar_one_or_none()
        if link:
            user = await UserService.get_user_by_id(db, link.user_id)
            if user:
                return user, "existing"

        # 2. Existing user with the same email? Auto-link (Google email is verified)
        existing_user = await UserService.get_user_by_email(db, email)
        if existing_user:
            new_link = OAuthAccount(
                user_id=existing_user.id,
                provider=provider,
                provider_account_id=provider_account_id,
                email=email.lower().strip(),
            )
            db.add(new_link)
            if not existing_user.email_verified:
                existing_user.email_verified = True
            await db.commit()
            return existing_user, "linked"

        # 3. New user — needs to pick a username
        return None, "needs_username"

    @staticmethod
    async def create_user_from_oauth(
        db: AsyncSession,
        *,
        provider: str,
        provider_account_id: str,
        email: str,
        username: str,
    ) -> User:
        """Create a brand-new user with an OAuth identity attached.

        Caller is responsible for validating username uniqueness/format
        before calling this. Email is marked verified because the provider
        already verified it.
        """
        user = User(
            email=email.lower().strip(),
            username=username.lower().strip(),
            hashed_password=None,
            email_verified=True,
        )
        db.add(user)
        await db.flush()  # populate user.id

        link = OAuthAccount(
            user_id=user.id,
            provider=provider,
            provider_account_id=provider_account_id,
            email=email.lower().strip(),
        )
        db.add(link)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def get_linked_accounts(db: AsyncSession, user_id: int) -> list[OAuthAccount]:
        result = await db.execute(
            select(OAuthAccount).where(OAuthAccount.user_id == user_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def unlink_account(db: AsyncSession, user_id: int, provider: str) -> bool:
        """Remove a provider link. Returns True on success.

        Caller must enforce the "don't unlink your only sign-in method" guard
        before invoking this.
        """
        result = await db.execute(
            select(OAuthAccount).where(
                OAuthAccount.user_id == user_id,
                OAuthAccount.provider == provider,
            )
        )
        link = result.scalar_one_or_none()
        if not link:
            return False
        await db.delete(link)
        await db.commit()
        return True

    # --- Pending signup JWT ---

    @staticmethod
    def issue_pending_signup_token(
        provider: str, provider_account_id: str, email: str
    ) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=PENDING_SIGNUP_TTL_MINUTES
        )
        payload = {
            "type": PENDING_SIGNUP_TYPE,
            "provider": provider,
            "sub": provider_account_id,
            "email": email,
            "exp": expire,
        }
        return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)

    @staticmethod
    def decode_pending_signup_token(token: str) -> dict | None:
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        except JWTError:
            return None
        if payload.get("type") != PENDING_SIGNUP_TYPE:
            return None
        return payload

    # --- Username generation / validation helpers ---

    USERNAME_REGEX = re.compile(r"^[a-z0-9_]{3,20}$")

    @staticmethod
    def slugify_username(raw: str) -> str:
        """Normalize an arbitrary string into a candidate username.

        Used to seed the username field in the picker UI from the OAuth
        display name. The result is not guaranteed unique or valid; the user
        will see and edit it before submitting.
        """
        slug = raw.lower().strip()
        slug = re.sub(r"[^a-z0-9_]+", "_", slug)
        slug = re.sub(r"_+", "_", slug).strip("_")
        if len(slug) > 20:
            slug = slug[:20]
        return slug
