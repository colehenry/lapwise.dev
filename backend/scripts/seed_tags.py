"""
Seed default discussion tags.

Usage:
    cd backend
    PYTHONPATH=$PWD python scripts/seed_tags.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.tag import Tag
from app.models.user import User, UserRole


TOPIC_TAGS = [
    ("Strategy", "#8B5CF6"),
    ("Telemetry", "#3B82F6"),
    ("Rules & Regs", "#EF4444"),
    ("Hot Take", "#F97316"),
    ("Data Analysis", "#06B6D4"),
    ("Race Review", "#10B981"),
    ("Prediction", "#EC4899"),
]

SEASON_TAGS = [
    ("2024", "#6366F1"),
    ("2025", "#8B5CF6"),
    ("2026", "#A855F7"),
]


async def seed_tags():
    async with AsyncSessionLocal() as db:
        # Find an admin user
        result = await db.execute(
            select(User).where(User.role == UserRole.admin).limit(1)
        )
        admin = result.scalar_one_or_none()
        if not admin:
            print("No admin user found. Run seed_admin_users.py first.")
            return

        created = 0

        for name, color in TOPIC_TAGS:
            slug = name.lower().replace(" & ", "-").replace(" ", "-")
            existing = await db.execute(select(Tag).where(Tag.slug == slug))
            if existing.scalar_one_or_none():
                print(f"  Tag '{name}' already exists, skipping")
                continue
            tag = Tag(
                name=name,
                slug=slug,
                color=color,
                category="topic",
                created_by=admin.id,
            )
            db.add(tag)
            created += 1
            print(f"  Created topic tag: {name}")

        for name, color in SEASON_TAGS:
            slug = name.lower()
            existing = await db.execute(select(Tag).where(Tag.slug == slug))
            if existing.scalar_one_or_none():
                print(f"  Tag '{name}' already exists, skipping")
                continue
            tag = Tag(
                name=name,
                slug=slug,
                color=color,
                category="season",
                created_by=admin.id,
            )
            db.add(tag)
            created += 1
            print(f"  Created season tag: {name}")

        await db.commit()
        print(f"\nDone! Created {created} tags.")


if __name__ == "__main__":
    asyncio.run(seed_tags())
