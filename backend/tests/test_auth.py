"""
Auth endpoint tests.

Tests registration, login, token refresh, logout, email verification,
and password reset flows.
"""

import pytest
from httpx import AsyncClient


# ─── Registration ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "username": "newuser",

            "password": "SecurePass1",
        },
    )
    assert resp.status_code == 201
    assert "check your email" in resp.json()["message"].lower()


@pytest.mark.asyncio
async def test_register_duplicate_email(
    client: AsyncClient, verified_user,
):
    resp = await client.post(
        "/auth/register",
        json={
            "email": verified_user["email"],
            "username": "different",

            "password": "SecurePass1",
        },
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_duplicate_username(
    client: AsyncClient, verified_user,
):
    resp = await client.post(
        "/auth/register",
        json={
            "email": "other@example.com",
            "username": verified_user["username"],

            "password": "SecurePass1",
        },
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={
            "email": "weak@example.com",
            "username": "weakuser",

            "password": "short",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_reserved_username(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={
            "email": "reserved@example.com",
            "username": "admin",

            "password": "SecurePass1",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_username(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={
            "email": "bad@example.com",
            "username": "BAD USER!",

            "password": "SecurePass1",
        },
    )
    assert resp.status_code == 422


# ─── Login ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_with_email(
    client: AsyncClient, verified_user,
):
    resp = await client.post(
        "/auth/login",
        json={
            "identifier": verified_user["email"],
            "password": "TestPass1",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["username"] == verified_user["username"]


@pytest.mark.asyncio
async def test_login_with_username(
    client: AsyncClient, verified_user,
):
    resp = await client.post(
        "/auth/login",
        json={
            "identifier": verified_user["username"],
            "password": "TestPass1",
        },
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_login_wrong_password(
    client: AsyncClient, verified_user,
):
    resp = await client.post(
        "/auth/login",
        json={
            "identifier": verified_user["email"],
            "password": "WrongPass1",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post(
        "/auth/login",
        json={
            "identifier": "nobody@example.com",
            "password": "Whatever1",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unverified_email(
    client: AsyncClient, unverified_user,
):
    resp = await client.post(
        "/auth/login",
        json={
            "identifier": unverified_user["email"],
            "password": "TestPass1",
        },
    )
    assert resp.status_code == 403
    assert "verify" in resp.json()["detail"].lower()


# ─── Token Refresh ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_refresh_no_cookie(client: AsyncClient):
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_invalid_cookie(client: AsyncClient):
    client.cookies.set(
        "refresh_token", "invalid_token", domain="test"
    )
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 401


# ─── Logout ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_logout_requires_auth(client: AsyncClient):
    resp = await client.post("/auth/logout")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_success(
    client: AsyncClient, auth_headers,
):
    resp = await client.post(
        "/auth/logout", headers=auth_headers
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_logout_all(
    client: AsyncClient, auth_headers,
):
    resp = await client.post(
        "/auth/logout-all", headers=auth_headers
    )
    assert resp.status_code == 200


# ─── Email Verification ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_email_bad_token(client: AsyncClient):
    resp = await client.get(
        "/auth/verify-email", params={"token": "badtoken"}
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_resend_verification_always_200(
    client: AsyncClient,
):
    resp = await client.post(
        "/auth/resend-verification",
        json={"email": "nonexistent@example.com"},
    )
    assert resp.status_code == 200


# ─── Password Reset ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_forgot_password_always_200(client: AsyncClient):
    resp = await client.post(
        "/auth/forgot-password",
        json={"email": "anyone@example.com"},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_reset_password_bad_token(client: AsyncClient):
    resp = await client.post(
        "/auth/reset-password",
        json={
            "token": "badtoken",
            "new_password": "NewPass1x",
        },
    )
    assert resp.status_code == 400


# ─── Current User ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_me_requires_auth(client: AsyncClient):
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_profile(
    client: AsyncClient, auth_headers, verified_user,
):
    resp = await client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == verified_user["username"]
    assert data["email"] == verified_user["email"]


@pytest.mark.asyncio
async def test_change_password_wrong_current(
    client: AsyncClient, auth_headers,
):
    resp = await client.post(
        "/auth/change-password",
        headers=auth_headers,
        json={
            "old_password": "WrongOld1",
            "new_password": "NewPass1x",
        },
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_change_password_success(
    client: AsyncClient, auth_headers,
):
    resp = await client.post(
        "/auth/change-password",
        headers=auth_headers,
        json={
            "old_password": "TestPass1",
            "new_password": "NewPass1x",
        },
    )
    assert resp.status_code == 200
