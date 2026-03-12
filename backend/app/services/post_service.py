"""
Post Service

Business logic for discussion posts.
"""

from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.post import Post, PostType
from app.models.vote import Vote
from app.services.tag_service import TagService


class PostService:
    @staticmethod
    async def create_post(
        db: AsyncSession,
        author_id: int,
        title: str,
        body: str,
        post_type: str,
        tag_ids: list[int],
    ) -> Post:
        tags = await TagService.get_tags_by_ids(db, tag_ids)

        post = Post(
            author_id=author_id,
            title=title,
            body=body,
            post_type=PostType(post_type),
        )
        post.tags = tags
        db.add(post)
        await db.commit()
        await db.refresh(post, ["author", "tags"])
        return post

    @staticmethod
    async def get_post(
        db: AsyncSession, post_id: int, current_user_id: int | None = None
    ) -> dict | None:
        result = await db.execute(
            select(Post)
            .options(selectinload(Post.author), selectinload(Post.tags))
            .where(Post.id == post_id, Post.deleted_at.is_(None))
        )
        post = result.scalar_one_or_none()
        if not post:
            return None

        user_voted = False
        if current_user_id:
            vote_result = await db.execute(
                select(Vote).where(
                    Vote.user_id == current_user_id,
                    Vote.post_id == post_id,
                )
            )
            user_voted = vote_result.scalar_one_or_none() is not None

        return {
            "id": post.id,
            "title": post.title,
            "body": post.body,
            "post_type": post.post_type.value,
            "is_pinned": post.is_pinned,
            "is_locked": post.is_locked,
            "vote_count": post.vote_count,
            "comment_count": post.comment_count,
            "author": post.author,
            "tags": post.tags,
            "user_voted": user_voted,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }

    @staticmethod
    async def get_posts(
        db: AsyncSession,
        cursor: str | None = None,
        limit: int = 20,
        sort: str = "new",
        tag_slug: str | None = None,
        post_type: str | None = None,
        current_user_id: int | None = None,
    ) -> dict:
        query = (
            select(Post)
            .options(selectinload(Post.author), selectinload(Post.tags))
            .where(Post.deleted_at.is_(None))
        )

        if tag_slug:
            from app.models.tag import Tag

            query = query.join(Post.tags).where(Tag.slug == tag_slug)

        if post_type:
            query = query.where(Post.post_type == PostType(post_type))

        # Sort: pinned first, then by sort criteria
        if sort == "top":
            query = query.order_by(
                desc(Post.is_pinned), desc(Post.vote_count), desc(Post.created_at)
            )
        else:  # "new" default
            query = query.order_by(desc(Post.is_pinned), desc(Post.created_at))

        # Cursor-based pagination (using post ID)
        if cursor:
            try:
                cursor_id = int(cursor)
                if sort == "top":
                    # For top sort, we need the vote count of the cursor post
                    cursor_post = await db.execute(
                        select(Post).where(Post.id == cursor_id)
                    )
                    cp = cursor_post.scalar_one_or_none()
                    if cp:
                        query = query.where(
                            (Post.vote_count < cp.vote_count)
                            | (
                                (Post.vote_count == cp.vote_count)
                                & (Post.id < cursor_id)
                            )
                        )
                else:
                    query = query.where(Post.id < cursor_id)
            except ValueError:
                pass

        query = query.limit(limit + 1)
        result = await db.execute(query)
        posts = list(result.scalars().unique().all())

        has_more = len(posts) > limit
        if has_more:
            posts = posts[:limit]

        # Batch check user votes
        user_votes = set()
        if current_user_id and posts:
            post_ids = [p.id for p in posts]
            vote_result = await db.execute(
                select(Vote.post_id).where(
                    Vote.user_id == current_user_id,
                    Vote.post_id.in_(post_ids),
                )
            )
            user_votes = {row[0] for row in vote_result.all()}

        items = []
        for post in posts:
            body_preview = (
                post.body[:300] + "..." if len(post.body) > 300 else post.body
            )
            items.append(
                {
                    "id": post.id,
                    "title": post.title,
                    "body": body_preview,
                    "post_type": post.post_type.value,
                    "is_pinned": post.is_pinned,
                    "is_locked": post.is_locked,
                    "vote_count": post.vote_count,
                    "comment_count": post.comment_count,
                    "author": post.author,
                    "tags": post.tags,
                    "user_voted": post.id in user_votes,
                    "created_at": post.created_at,
                }
            )

        next_cursor = str(posts[-1].id) if has_more and posts else None

        return {"posts": items, "next_cursor": next_cursor}

    @staticmethod
    async def count_posts(db: AsyncSession) -> int:
        from sqlalchemy import func
        stmt = select(func.count()).select_from(Post).where(Post.deleted_at.is_(None))
        result = await db.execute(stmt)
        return result.scalar() or 0

    @staticmethod
    async def update_post(
        db: AsyncSession, post_id: int, user_id: int, is_admin: bool, **updates
    ) -> Post | None:
        result = await db.execute(
            select(Post)
            .options(selectinload(Post.tags))
            .where(Post.id == post_id, Post.deleted_at.is_(None))
        )
        post = result.scalar_one_or_none()
        if not post:
            return None
        if post.author_id != user_id and not is_admin:
            raise PermissionError("Not authorized to edit this post")

        if "title" in updates and updates["title"] is not None:
            post.title = updates["title"]
        if "body" in updates and updates["body"] is not None:
            post.body = updates["body"]
        if "tag_ids" in updates and updates["tag_ids"] is not None:
            post.tags = await TagService.get_tags_by_ids(db, updates["tag_ids"])

        await db.commit()
        await db.refresh(post, ["author", "tags"])
        return post

    @staticmethod
    async def delete_post(
        db: AsyncSession, post_id: int, user_id: int, is_admin: bool
    ) -> bool:
        result = await db.execute(
            select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
        )
        post = result.scalar_one_or_none()
        if not post:
            return False
        if post.author_id != user_id and not is_admin:
            raise PermissionError("Not authorized to delete this post")

        post.deleted_at = datetime.now(timezone.utc)
        await db.commit()
        return True

    @staticmethod
    async def pin_post(db: AsyncSession, post_id: int) -> Post | None:
        result = await db.execute(
            select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
        )
        post = result.scalar_one_or_none()
        if not post:
            return None
        post.is_pinned = not post.is_pinned
        await db.commit()
        return post

    @staticmethod
    async def lock_post(db: AsyncSession, post_id: int) -> Post | None:
        result = await db.execute(
            select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
        )
        post = result.scalar_one_or_none()
        if not post:
            return None
        post.is_locked = not post.is_locked
        await db.commit()
        return post
