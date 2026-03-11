"""
Seed Admin Users

Creates initial admin accounts for the platform.
Run: PYTHONPATH=$PWD python scripts/seed_admin_users.py
"""

import asyncio
import sys

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.services.auth_service import AuthService


ADMIN_USERS = [
    {
        "email": "admin@lapwise.dev",
        "username": "admin",
        "display_name": "Admin",
    },
    {
        "email": "cole@lapwise.dev",
        "username": "colehenry",
        "display_name": "Cole Henry",
    },
]


async def seed():
    async with AsyncSessionLocal() as db:
        for user_data in ADMIN_USERS:
            result = await db.execute(
                select(User).where(
                    User.username == user_data["username"]
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                print(f"  User '{user_data['username']}' already exists, skipping")
                continue

            password = input(
                f"  Password for '{user_data['username']}': "
            )
            if not password:
                print(f"  Skipping '{user_data['username']}' (empty password)")
                continue

            user = User(
                email=user_data["email"],
                username=user_data["username"],
                display_name=user_data["display_name"],
                hashed_password=AuthService.hash_password(password),
                role=UserRole.admin,
                email_verified=True,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            print(f"  Created admin user '{user_data['username']}'")

    print("Done.")


if __name__ == "__main__":
    print("Seeding admin users...")
    asyncio.run(seed())
