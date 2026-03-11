"""
Auth Router

Authentication endpoints: register, login, refresh, logout, email verification,
password reset.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_active_user

limiter = Limiter(key_func=get_remote_address)
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenRefreshResponse,
    UserProfile,
)
from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from app.services.user_service import UserService

router = APIRouter()

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60  # 30 days in seconds


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path="/auth")


def _user_profile(user: User) -> UserProfile:
    return UserProfile(
        id=user.id,
        email=user.email,
        username=user.username,
        display_name=user.display_name,
        role=user.role.value,
        email_verified=user.email_verified,
        avatar_url=user.avatar_url,
        bio=user.bio,
        created_at=user.created_at,
    )


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ─── Register ───────────────────────────────────────────────────────


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Check duplicate email
    existing = await UserService.get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Check duplicate username
    existing = await UserService.get_user_by_username(db, body.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    user = await UserService.create_user(
        db,
        email=body.email,
        username=body.username,
        display_name=body.display_name,
        password=body.password,
    )

    # Send verification email
    token = await UserService.create_email_verification_token(db, user.id)
    EmailService.send_verification_email(user.email, user.username, token)

    return {"message": "Account created. Please check your email to verify."}


# ─── Login ──────────────────────────────────────────────────────────


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    ip = _client_ip(request)
    ua = request.headers.get("user-agent")

    # Rate limit check
    allowed = await AuthService.check_login_rate_limit(db, ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )

    # Find user
    user = await UserService.get_user_by_email_or_username(db, body.identifier)
    if not user or not user.hashed_password:
        await AuthService.record_login_attempt(
            db, None, ip, ua, False, "user_not_found"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Verify password
    if not AuthService.verify_password(body.password, user.hashed_password):
        await AuthService.record_login_attempt(
            db, user.id, ip, ua, False, "invalid_password"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Check active
    if not user.is_active:
        await AuthService.record_login_attempt(
            db, user.id, ip, ua, False, "account_deactivated"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # Check email verified
    if not user.email_verified:
        await AuthService.record_login_attempt(
            db, user.id, ip, ua, False, "email_not_verified"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in",
        )

    # Success — issue tokens
    access_token = AuthService.create_access_token(user.id, user.role.value)
    refresh_token = AuthService.create_refresh_token()
    await AuthService.store_refresh_token(db, user.id, refresh_token, ip, ua)

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    await AuthService.record_login_attempt(db, user.id, ip, ua, True)

    _set_refresh_cookie(response, refresh_token)

    return LoginResponse(
        access_token=access_token,
        user=_user_profile(user),
    )


# ─── Refresh ────────────────────────────────────────────────────────


@router.post("/refresh", response_model=TokenRefreshResponse)
@limiter.limit("30/minute")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    old_token = request.cookies.get(REFRESH_COOKIE)
    if not old_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    stored = await AuthService.validate_refresh_token(db, old_token)
    if not stored:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = await UserService.get_user_by_id(db, stored.user_id)
    if not user or not user.is_active:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    # Rotate: revoke old, issue new
    await AuthService.revoke_refresh_token(db, old_token)
    new_refresh = AuthService.create_refresh_token()
    ip = _client_ip(request)
    ua = request.headers.get("user-agent")
    await AuthService.store_refresh_token(db, user.id, new_refresh, ip, ua)

    access_token = AuthService.create_access_token(user.id, user.role.value)
    _set_refresh_cookie(response, new_refresh)

    return TokenRefreshResponse(access_token=access_token)


# ─── Logout ─────────────────────────────────────────────────────────


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    old_token = request.cookies.get(REFRESH_COOKIE)
    if old_token:
        await AuthService.revoke_refresh_token(db, old_token)
    _clear_refresh_cookie(response)
    return {"message": "Logged out"}


@router.post("/logout-all")
async def logout_all(
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    await AuthService.revoke_all_user_tokens(db, user.id)
    _clear_refresh_cookie(response)
    return {"message": "Logged out from all devices"}


# ─── Email Verification ────────────────────────────────────────────


@router.get("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    success = await UserService.verify_email(db, token)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    body: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await UserService.get_user_by_email(db, body.email)
    if user and not user.email_verified:
        token = await UserService.create_email_verification_token(db, user.id)
        EmailService.send_verification_email(user.email, user.username, token)
    # Always return success to avoid leaking whether the email exists
    return {
        "message": "If that email is registered, a verification link has been sent."
    }


# ─── Password Reset ────────────────────────────────────────────────


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    token = await UserService.create_password_reset_token(db, body.email)
    if token:
        user = await UserService.get_user_by_email(db, body.email)
        if user:
            EmailService.send_password_reset_email(user.email, user.username, token)
    # Always return success
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    success = await UserService.reset_password(db, body.token, body.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    return {"message": "Password reset successfully"}


# ─── Current User ──────────────────────────────────────────────────


@router.get("/me", response_model=UserProfile)
async def get_me(user: User = Depends(get_current_active_user)):
    return _user_profile(user)


@router.put("/me", response_model=UserProfile)
async def update_me(
    updates: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    # Only allow safe fields
    allowed = {"display_name", "bio", "avatar_url"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update",
        )
    updated = await UserService.update_user_profile(db, user.id, filtered)
    return _user_profile(updated)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    success = await UserService.change_password(
        db, user.id, body.old_password, body.new_password
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    EmailService.send_password_changed_notification(user.email, user.username)
    return {"message": "Password changed successfully"}
