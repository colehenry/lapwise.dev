"""
OAuth Router

Handles the Google OAuth login/signup/link flows. The OAuth dance is:

  1. Frontend full-page-navigates to GET /auth/oauth/google/login
     (?next=... and ?mode=link supported)
  2. We redirect to Google's authorize URL via Authlib
  3. Google bounces back to GET /auth/oauth/google/callback
  4. We resolve the identity to a local user via OAuthService:
     - "existing" / "linked" → issue refresh cookie + redirect to frontend
     - "needs_username"      → set pending_oauth_signup cookie + redirect to
                               frontend username picker
  5. (Picker case only) Frontend POSTs to /auth/oauth/google/complete with the
     chosen username; we create the user and issue tokens.

The "link mode" is the same flow except the callback attaches the OAuth
identity to the currently-logged-in user instead of finding/creating one.
"""

from datetime import datetime, timezone

from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_active_user
from app.config import settings
from app.database import get_db
from app.models.oauth_account import OAuthAccount
from app.models.user import User
from app.routers.auth import (
    _client_ip,
    _set_refresh_cookie,
    _user_profile,
)
from app.schemas.auth import (
    LoginResponse,
    RESERVED_USERNAMES,
    USERNAME_REGEX,
)
from app.services.auth_service import AuthService
from app.services.oauth_service import OAuthService
from app.services.user_service import UserService

router = APIRouter()

PENDING_SIGNUP_COOKIE = "pending_oauth_signup"
PENDING_SIGNUP_TTL_SECONDS = 600  # 10 minutes — matches the JWT TTL

# Authlib client registry. Endpoints are read from Google's OIDC discovery doc
# so we don't have to hard-code authorize/token URLs.
_oauth = OAuth()
_oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def _google_callback_url() -> str:
    base = settings.oauth_redirect_base_url.rstrip("/")
    return f"{base}/auth/oauth/google/callback"


def _set_pending_signup_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=PENDING_SIGNUP_COOKIE,
        value=token,
        httponly=True,
        secure=settings.frontend_url.startswith("https://"),
        samesite="lax",
        max_age=PENDING_SIGNUP_TTL_SECONDS,
        path="/auth/oauth",
    )


def _clear_pending_signup_cookie(response: Response) -> None:
    response.delete_cookie(key=PENDING_SIGNUP_COOKIE, path="/auth/oauth")


def _frontend_url(path: str) -> str:
    base = settings.frontend_url.rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


async def _issue_session_and_redirect(
    *,
    user: User,
    request: Request,
    redirect_to: str,
    db: AsyncSession,
) -> RedirectResponse:
    """Mint refresh cookie + redirect to a frontend page that will pick up
    the session via /auth/refresh."""
    ip = _client_ip(request)
    ua = request.headers.get("user-agent")
    refresh_token = AuthService.create_refresh_token()
    await AuthService.store_refresh_token(db, user.id, refresh_token, ip, ua)
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await AuthService.record_login_attempt(db, user.id, ip, ua, True)

    redirect = RedirectResponse(url=redirect_to, status_code=302)
    _set_refresh_cookie(redirect, refresh_token)
    return redirect


# ─── Start ─────────────────────────────────────────────────────────


@router.get("/google/login")
async def google_login(request: Request, next: str | None = None):
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured",
        )
    redirect_uri = _google_callback_url()
    # Stash the post-login destination on the session so the callback can
    # honor ?next=... without leaking it through Google.
    request.session["oauth_next"] = next or "/"
    request.session["oauth_mode"] = "login"
    return await _oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/link")
async def google_link(
    request: Request,
    next: str | None = None,
    user: User = Depends(get_current_active_user),
):
    """Same as /login, but the callback links the identity to the current
    user instead of creating/finding one."""
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured",
        )
    redirect_uri = _google_callback_url()
    request.session["oauth_next"] = next or "/settings"
    request.session["oauth_mode"] = "link"
    request.session["oauth_link_user_id"] = user.id
    return await _oauth.google.authorize_redirect(request, redirect_uri)


# ─── Callback ──────────────────────────────────────────────────────


@router.get("/google/callback")
async def google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    try:
        token = await _oauth.google.authorize_access_token(request)
    except OAuthError:
        return RedirectResponse(
            url=_frontend_url("/login?oauth_error=exchange_failed"),
            status_code=302,
        )

    userinfo = token.get("userinfo") or {}
    provider_account_id = userinfo.get("sub")
    email = userinfo.get("email")
    email_verified = userinfo.get("email_verified", False)

    if not provider_account_id or not email:
        return RedirectResponse(
            url=_frontend_url("/login?oauth_error=missing_profile"),
            status_code=302,
        )
    if not email_verified:
        return RedirectResponse(
            url=_frontend_url("/login?oauth_error=email_unverified"),
            status_code=302,
        )

    mode = request.session.pop("oauth_mode", "login")
    next_path = request.session.pop("oauth_next", "/")

    # ── Link mode: attach identity to currently-logged-in user ──
    if mode == "link":
        link_user_id = request.session.pop("oauth_link_user_id", None)
        if not link_user_id:
            return RedirectResponse(
                url=_frontend_url("/settings?oauth_error=link_session_lost"),
                status_code=302,
            )
        # Refuse if this Google account is already linked to a different user
        existing = await db.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == "google",
                OAuthAccount.provider_account_id == provider_account_id,
            )
        )
        existing_link = existing.scalar_one_or_none()
        if existing_link and existing_link.user_id != link_user_id:
            return RedirectResponse(
                url=_frontend_url("/settings?oauth_error=already_linked_other"),
                status_code=302,
            )
        if not existing_link:
            db.add(
                OAuthAccount(
                    user_id=link_user_id,
                    provider="google",
                    provider_account_id=provider_account_id,
                    email=email.lower().strip(),
                )
            )
            await db.commit()
        return RedirectResponse(
            url=_frontend_url(f"{next_path}?google_linked=1"),
            status_code=302,
        )

    # ── Login/signup mode ──
    user, link_status = await OAuthService.find_or_link_user(
        db,
        provider="google",
        provider_account_id=provider_account_id,
        email=email,
    )

    if link_status == "needs_username":
        pending = OAuthService.issue_pending_signup_token(
            provider="google",
            provider_account_id=provider_account_id,
            email=email,
        )
        # Pre-seed a candidate username from the OAuth display name
        suggested = OAuthService.slugify_username(
            userinfo.get("name") or email.split("@")[0]
        )
        redirect = RedirectResponse(
            url=_frontend_url(f"/auth/oauth/choose-username?suggested={suggested}"),
            status_code=302,
        )
        _set_pending_signup_cookie(redirect, pending)
        return redirect

    # existing or linked → issue session, redirect to /auth/callback
    if user is None:
        # Shouldn't happen given the link_status branches, but be defensive
        return RedirectResponse(
            url=_frontend_url("/login?oauth_error=unknown"),
            status_code=302,
        )
    if not user.is_active:
        return RedirectResponse(
            url=_frontend_url("/login?oauth_error=account_deactivated"),
            status_code=302,
        )
    return await _issue_session_and_redirect(
        user=user,
        request=request,
        redirect_to=_frontend_url(f"/auth/callback?next={next_path}"),
        db=db,
    )


# ─── Complete signup (username picker) ─────────────────────────────


class CompleteSignupRequest(BaseModel):
    username: str


@router.post("/google/complete", response_model=LoginResponse)
async def google_complete(
    body: CompleteSignupRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    pending = request.cookies.get(PENDING_SIGNUP_COOKIE)
    if not pending:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your sign-in session expired. Please try again.",
        )
    payload = OAuthService.decode_pending_signup_token(pending)
    if not payload:
        _clear_pending_signup_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your sign-in session expired. Please try again.",
        )

    username = body.username.lower().strip()
    if not USERNAME_REGEX.match(username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Username must be 3-20 characters, lowercase letters, "
                "numbers, and underscores"
            ),
        )
    if username in RESERVED_USERNAMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That username is reserved",
        )
    if await UserService.get_user_by_username(db, username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken",
        )

    # Edge case: while the user was picking a username, someone else may have
    # registered with the same email through the password flow.
    if await UserService.get_user_by_email(db, payload["email"]):
        _clear_pending_signup_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An account with that email was just created. "
                "Please sign in with Google again to link it."
            ),
        )

    user = await OAuthService.create_user_from_oauth(
        db,
        provider=payload["provider"],
        provider_account_id=payload["sub"],
        email=payload["email"],
        username=username,
    )

    ip = _client_ip(request)
    ua = request.headers.get("user-agent")
    access_token = AuthService.create_access_token(user.id, user.role.value)
    refresh_token = AuthService.create_refresh_token()
    await AuthService.store_refresh_token(db, user.id, refresh_token, ip, ua)
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await AuthService.record_login_attempt(db, user.id, ip, ua, True)

    _set_refresh_cookie(response, refresh_token)
    _clear_pending_signup_cookie(response)

    return LoginResponse(
        access_token=access_token,
        user=await _user_profile(user, db),
    )


# ─── Connected accounts (settings page) ─────────────────────────────


class ConnectedAccount(BaseModel):
    provider: str
    email: str | None
    created_at: datetime


class ConnectedAccountsResponse(BaseModel):
    accounts: list[ConnectedAccount]
    has_password: bool


@router.get("/connected", response_model=ConnectedAccountsResponse)
async def list_connected(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    accounts = await OAuthService.get_linked_accounts(db, user.id)
    return ConnectedAccountsResponse(
        accounts=[
            ConnectedAccount(
                provider=a.provider,
                email=a.email,
                created_at=a.created_at,
            )
            for a in accounts
        ],
        has_password=user.hashed_password is not None,
    )


@router.delete("/{provider}")
async def unlink_provider(
    provider: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    accounts = await OAuthService.get_linked_accounts(db, user.id)
    if not any(a.provider == provider for a in accounts):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not linked",
        )
    # Guard: don't strand a user with no way to sign in
    if user.hashed_password is None and len(accounts) == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=("Set a password before disconnecting your only " "sign-in method"),
        )
    await OAuthService.unlink_account(db, user.id, provider)
    return {"message": "Disconnected"}
