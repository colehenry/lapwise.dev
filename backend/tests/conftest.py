"""
Test fixtures for auth tests.

Uses sync psycopg2 for all setup/teardown to avoid
async connection pool conflicts with the test client.
"""

import psycopg2
import psycopg2.extras
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.config import settings
from app.database import engine
from app.main import app
from app.services.auth_service import AuthService


def _sync_db_url():
    """Convert async DB URL to sync psycopg2 URL."""
    url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    return url.replace("?ssl=require", "?sslmode=require")


def _get_sync_conn():
    conn = psycopg2.connect(_sync_db_url())
    conn.autocommit = True
    return conn


def _cleanup():
    """Remove all test-created auth data."""
    conn = _get_sync_conn()
    cur = conn.cursor()
    fk_where = (
        "user_id IN (SELECT id FROM users "
        "WHERE email LIKE '%%@lapwise.dev' "
        "OR email LIKE '%%@example.com')"
    )
    cur.execute(
        f"DELETE FROM login_history " f"WHERE ip_address = 'testclient' OR {fk_where}"
    )
    cur.execute(f"DELETE FROM refresh_tokens WHERE {fk_where}")
    cur.execute(f"DELETE FROM email_verification_tokens WHERE {fk_where}")
    cur.execute(f"DELETE FROM password_reset_tokens WHERE {fk_where}")
    cur.execute(
        "DELETE FROM users "
        "WHERE email LIKE '%%@lapwise.dev' "
        "OR email LIKE '%%@example.com'"
    )
    cur.close()
    conn.close()


def _create_user(
    email,
    username,
    password,
    role="user",
    verified=True,
    active=True,
):
    """Create a user via sync connection, return dict with id."""
    conn = _get_sync_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    hashed = AuthService.hash_password(password)
    cur.execute(
        "INSERT INTO users "
        "(email, username, hashed_password, "
        "role, email_verified, is_active) "
        "VALUES (%s, %s, %s, %s, %s, %s) "
        "RETURNING id, email, username, role, "
        "email_verified, is_active, created_at",
        (email, username, hashed, role, verified, active),
    )
    row = dict(cur.fetchone())
    cur.close()
    conn.close()
    return row


@pytest_asyncio.fixture(autouse=True)
async def cleanup_test_data():
    """Clean up test data and reset connection pool between tests."""
    _cleanup()
    yield
    await engine.dispose()
    _cleanup()


@pytest_asyncio.fixture
async def client():
    """Async HTTP test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def verified_user():
    """Create a verified user for login tests."""
    return _create_user(
        email="testuser@lapwise.dev",
        username="testuser",
        password="TestPass1",
        role="user",
        verified=True,
    )


@pytest.fixture
def unverified_user():
    """Create an unverified user."""
    return _create_user(
        email="unverified@lapwise.dev",
        username="unverified",
        password="TestPass1",
        role="user",
        verified=False,
    )


@pytest.fixture
def admin_user():
    """Create an admin user."""
    return _create_user(
        email="admintest@lapwise.dev",
        username="admintest",
        password="AdminPass1",
        role="admin",
        verified=True,
    )


@pytest.fixture
def auth_headers(verified_user):
    """Return Bearer auth headers for the verified user."""
    token = AuthService.create_access_token(verified_user["id"], verified_user["role"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(admin_user):
    """Return Bearer auth headers for the admin user."""
    token = AuthService.create_access_token(admin_user["id"], admin_user["role"])
    return {"Authorization": f"Bearer {token}"}
