"""
User public profile tests.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_public_profile_success(client: AsyncClient, verified_user):
    username = verified_user["username"]
    resp = await client.get(f"/api/users/{username}")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == username
    assert data["role"] == verified_user["role"]
    assert "email" not in data  # Sensitive data should be hidden
    assert "id" not in data     # Internal IDs should be hidden
    assert "created_at" in data


@pytest.mark.asyncio
async def test_get_public_profile_not_found(client: AsyncClient):
    resp = await client.get("/api/users/nonexistent_user_12345")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_public_profile_deactivated(client: AsyncClient, verified_user):
    # First delete/deactivate the account
    login = await client.post(
        "/auth/login",
        json={
            "identifier": verified_user["email"],
            "password": "TestPass1",
        },
    )
    access_token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    
    await client.post(
        "/auth/delete-account",
        headers=headers,
        json={"password": "TestPass1"},
    )
    
    # Now try to get public profile
    resp = await client.get(f"/api/users/{verified_user['username']}")
    assert resp.status_code == 404
