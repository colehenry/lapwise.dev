"""
Auth Router

Authentication endpoints: register, login, refresh, logout, email verification,
password reset.
"""

import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_active_user

from app.database import get_db
from app.limiter import limiter
from app.models.user import User
from app.request_context import get_client_ip
from app.schemas.auth import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SessionInfo,
    SessionsResponse,
    TokenRefreshResponse,
    UpdateProfileRequest,
    UserProfile,
    UsernameAvailabilityResponse,
    RESERVED_USERNAMES,
    USERNAME_REGEX,
)
from app.services.auth_service import AuthService
from app.config import settings
from app.services.email_service import EmailService
from app.services.user_service import UserService

router = APIRouter()

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60  # 30 days in seconds


def _set_refresh_cookie(response: Response, token: str) -> None:
    secure_cookie = settings.frontend_url.startswith("https://")
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path="/auth")


async def _user_profile(user: User, db: AsyncSession) -> UserProfile:
    profile = UserProfile.model_validate(user)
    profile.has_password = user.hashed_password is not None
    favorites = await UserService.resolve_user_favorites(db, user)
    if "favorite_driver" in favorites:
        profile.favorite_driver = favorites["favorite_driver"]
    if "favorite_team" in favorites:
        profile.favorite_team = favorites["favorite_team"]
    if "favorite_circuit" in favorites:
        profile.favorite_circuit = favorites["favorite_circuit"]
    return profile


def _client_ip(request: Request) -> str:
    return get_client_ip(request)


# ─── Register ───────────────────────────────────────────────────────


@router.get("/username-available", response_model=UsernameAvailabilityResponse)
@limiter.limit("30/minute")
async def username_available(
    username: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    normalized = username.lower().strip()
    if not normalized or not USERNAME_REGEX.match(normalized):
        return UsernameAvailabilityResponse(available=False, reason="invalid")
    if normalized in RESERVED_USERNAMES:
        return UsernameAvailabilityResponse(available=False, reason="reserved")
    existing = await UserService.get_user_by_username(db, normalized)
    if existing:
        return UsernameAvailabilityResponse(available=False, reason="taken")
    return UsernameAvailabilityResponse(available=True)


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if body.website:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed",
        )

    if body.form_started_at is not None:
        elapsed_ms = int(time.time() * 1000) - body.form_started_at
        if elapsed_ms < 1500:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please try submitting the form again.",
            )

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
        user=await _user_profile(user, db),
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


@router.get("/sessions", response_model=SessionsResponse)
async def list_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    sessions = await AuthService.get_user_sessions(db, user.id)
    current_cookie = request.cookies.get(REFRESH_COOKIE)
    current_hash = (
        AuthService.hash_refresh_token(current_cookie) if current_cookie else None
    )
    return SessionsResponse(
        sessions=[
            SessionInfo(
                id=session.id,
                device_info=session.device_info,
                ip_address=session.ip_address,
                created_at=session.created_at,
                expires_at=session.expires_at,
                revoked_at=session.revoked_at,
                is_current=current_hash == session.token_hash
                if current_hash
                else False,
            )
            for session in sessions
        ]
    )


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: int,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    session = await AuthService.revoke_user_session(db, session_id, user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    current_cookie = request.cookies.get(REFRESH_COOKIE)
    if (
        current_cookie
        and AuthService.hash_refresh_token(current_cookie) == session.token_hash
    ):
        _clear_refresh_cookie(response)

    return {"message": "Session revoked"}


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
async def get_me(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    return await _user_profile(user, db)


@router.put("/me", response_model=UserProfile)
async def update_me(
    updates: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    filtered = updates.model_dump(exclude_unset=True)
    if not filtered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update",
        )

    # Resolve driver slug to driver ID
    if "favorite_driver_slug" in filtered:
        slug = filtered.pop("favorite_driver_slug")
        if slug:
            from app.models.driver import Driver
            from sqlalchemy import select, or_

            result = await db.execute(
                select(Driver).where(
                    or_(
                        Driver.jolpica_id == slug.replace("-", "_"),
                        Driver.jolpica_id == slug,
                    )
                )
            )
            driver = result.scalar_one_or_none()
            if driver:
                filtered["favorite_driver_id"] = driver.id
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Driver not found",
                )
        else:
            filtered["favorite_driver_id"] = None

    updated = await UserService.update_user_profile(db, user.id, filtered)
    return await _user_profile(updated, db)


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


@router.post("/delete-account")
async def delete_account(
    body: DeleteAccountRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    if not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password required",
        )
    if not AuthService.verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is incorrect",
        )
    user.is_active = False
    await AuthService.revoke_all_user_tokens(db, user.id)
    await db.commit()
    _clear_refresh_cookie(response)
    return {"message": "Account deleted"}
