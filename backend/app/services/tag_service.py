"""
Tag Service

Business logic for tag management.
"""

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag


class TagService:
    @staticmethod
    def _slugify(name: str) -> str:
        slug = name.lower().strip()
        slug = re.sub(r"[^a-z0-9\s-]", "", slug)
        slug = re.sub(r"[\s-]+", "-", slug)
        return slug.strip("-")

    @staticmethod
    async def get_all_tags(db: AsyncSession) -> list[Tag]:
        result = await db.execute(select(Tag).order_by(Tag.category, Tag.name))
        return list(result.scalars().all())

    @staticmethod
    async def get_tags_by_category(db: AsyncSession, category: str) -> list[Tag]:
        result = await db.execute(
            select(Tag).where(Tag.category == category).order_by(Tag.name)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_tag_by_id(db: AsyncSession, tag_id: int) -> Tag | None:
        result = await db.execute(select(Tag).where(Tag.id == tag_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_tags_by_ids(db: AsyncSession, tag_ids: list[int]) -> list[Tag]:
        if not tag_ids:
            return []
        result = await db.execute(select(Tag).where(Tag.id.in_(tag_ids)))
        return list(result.scalars().all())

    @staticmethod
    async def create_tag(
        db: AsyncSession,
        name: str,
        color: str,
        category: str | None,
        created_by: int,
    ) -> Tag:
        slug = TagService._slugify(name)

        # Check uniqueness
        existing = await db.execute(
            select(Tag).where((Tag.name == name) | (Tag.slug == slug))
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Tag '{name}' already exists")

        tag = Tag(
            name=name,
            slug=slug,
            color=color,
            category=category,
            created_by=created_by,
        )
        db.add(tag)
        await db.commit()
        await db.refresh(tag)
        return tag

    @staticmethod
    async def update_tag(db: AsyncSession, tag_id: int, **updates) -> Tag | None:
        tag = await TagService.get_tag_by_id(db, tag_id)
        if not tag:
            return None

        if "name" in updates and updates["name"] is not None:
            tag.name = updates["name"]
            tag.slug = TagService._slugify(updates["name"])
        if "color" in updates and updates["color"] is not None:
            tag.color = updates["color"]
        if "category" in updates:
            tag.category = updates["category"]

        await db.commit()
        await db.refresh(tag)
        return tag

    @staticmethod
    async def delete_tag(db: AsyncSession, tag_id: int) -> bool:
        tag = await TagService.get_tag_by_id(db, tag_id)
        if not tag:
            return False
        await db.delete(tag)
        await db.commit()
        return True
