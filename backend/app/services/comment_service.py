"""
Comment Service

Business logic for post comments.
"""

from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.comment import Comment
from app.models.post import Post
from app.models.vote import Vote


class CommentService:
    @staticmethod
    async def create_comment(
        db: AsyncSession,
        post_id: int,
        author_id: int,
        body: str,
        parent_comment_id: int | None = None,
    ) -> Comment:
        # Verify post exists and isn't locked
        post_result = await db.execute(
            select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
        )
        post = post_result.scalar_one_or_none()
        if not post:
            raise ValueError("Post not found")
        if post.is_locked:
            raise PermissionError("Post is locked")

        # Verify parent comment exists if provided
        if parent_comment_id:
            parent_result = await db.execute(
                select(Comment).where(
                    Comment.id == parent_comment_id,
                    Comment.post_id == post_id,
                    Comment.deleted_at.is_(None),
                )
            )
            if not parent_result.scalar_one_or_none():
                raise ValueError("Parent comment not found")

        comment = Comment(
            post_id=post_id,
            author_id=author_id,
            body=body,
            parent_comment_id=parent_comment_id,
        )
        db.add(comment)

        # Increment post comment count
        post.comment_count = post.comment_count + 1

        await db.commit()
        await db.refresh(comment, ["author"])
        return comment

    @staticmethod
    async def get_comments(
        db: AsyncSession,
        post_id: int,
        cursor: str | None = None,
        limit: int = 50,
        sort: str = "new",
        current_user_id: int | None = None,
    ) -> dict:
        # Get top-level comments with their replies
        query = (
            select(Comment)
            .options(
                selectinload(Comment.author),
                selectinload(Comment.replies).selectinload(Comment.author),
            )
            .where(
                Comment.post_id == post_id,
                Comment.parent_comment_id.is_(None),
                Comment.deleted_at.is_(None),
            )
        )

        if sort == "top":
            query = query.order_by(desc(Comment.vote_count), Comment.created_at)
        else:  # "new" default
            query = query.order_by(Comment.created_at)

        if cursor:
            try:
                cursor_id = int(cursor)
                query = query.where(Comment.id > cursor_id)
            except ValueError:
                pass

        query = query.limit(limit + 1)
        result = await db.execute(query)
        comments = list(result.scalars().unique().all())

        has_more = len(comments) > limit
        if has_more:
            comments = comments[:limit]

        # Batch check user votes on all comments + replies
        user_votes = set()
        if current_user_id and comments:
            all_ids = []
            for c in comments:
                all_ids.append(c.id)
                for r in c.replies or []:
                    if r.deleted_at is None:
                        all_ids.append(r.id)

            if all_ids:
                vote_result = await db.execute(
                    select(Vote.comment_id).where(
                        Vote.user_id == current_user_id,
                        Vote.comment_id.in_(all_ids),
                    )
                )
                user_votes = {row[0] for row in vote_result.all()}

        def serialize_comment(c):
            replies = []
            for r in c.replies or []:
                if r.deleted_at is None:
                    replies.append(
                        {
                            "id": r.id,
                            "post_id": r.post_id,
                            "parent_comment_id": r.parent_comment_id,
                            "body": r.body,
                            "vote_count": r.vote_count,
                            "author": r.author,
                            "user_voted": r.id in user_votes,
                            "replies": [],
                            "created_at": r.created_at,
                            "updated_at": r.updated_at,
                        }
                    )

            return {
                "id": c.id,
                "post_id": c.post_id,
                "parent_comment_id": c.parent_comment_id,
                "body": c.body,
                "vote_count": c.vote_count,
                "author": c.author,
                "user_voted": c.id in user_votes,
                "replies": replies,
                "created_at": c.created_at,
                "updated_at": c.updated_at,
            }

        items = [serialize_comment(c) for c in comments]
        next_cursor = str(comments[-1].id) if has_more and comments else None

        return {"comments": items, "next_cursor": next_cursor}

    @staticmethod
    async def get_admin_comments(
        db: AsyncSession, post_id: int, include_deleted: bool = True
    ) -> list:
        query = (
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.post_id == post_id, Comment.parent_comment_id.is_(None))
            .order_by(Comment.created_at)
        )
        if not include_deleted:
            query = query.where(Comment.deleted_at.is_(None))

        result = await db.execute(query)
        comments = list(result.scalars().unique().all())

        items = []
        for c in comments:
            items.append(
                {
                    "id": c.id,
                    "post_id": c.post_id,
                    "parent_comment_id": c.parent_comment_id,
                    "body": c.body,
                    "vote_count": c.vote_count,
                    "author": c.author,
                    "deleted_at": c.deleted_at,
                    "created_at": c.created_at,
                    "updated_at": c.updated_at,
                }
            )
        return items

    @staticmethod
    async def restore_comment(db: AsyncSession, comment_id: int) -> Comment | None:
        result = await db.execute(select(Comment).where(Comment.id == comment_id))
        comment = result.scalar_one_or_none()
        if not comment:
            return None
        comment.deleted_at = None

        post_result = await db.execute(select(Post).where(Post.id == comment.post_id))
        post = post_result.scalar_one_or_none()
        if post:
            post.comment_count = post.comment_count + 1

        await db.commit()
        return comment

    @staticmethod
    async def update_comment(
        db: AsyncSession, comment_id: int, user_id: int, is_admin: bool, body: str
    ) -> Comment | None:
        result = await db.execute(
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.id == comment_id, Comment.deleted_at.is_(None))
        )
        comment = result.scalar_one_or_none()
        if not comment:
            return None
        if comment.author_id != user_id and not is_admin:
            raise PermissionError("Not authorized to edit this comment")

        comment.body = body
        await db.commit()
        await db.refresh(comment)
        return comment

    @staticmethod
    async def delete_comment(
        db: AsyncSession, comment_id: int, user_id: int, is_admin: bool
    ) -> bool:
        result = await db.execute(
            select(Comment).where(
                Comment.id == comment_id, Comment.deleted_at.is_(None)
            )
        )
        comment = result.scalar_one_or_none()
        if not comment:
            return False
        if comment.author_id != user_id and not is_admin:
            raise PermissionError("Not authorized to delete this comment")

        comment.deleted_at = datetime.now(timezone.utc)

        # Decrement post comment count
        post_result = await db.execute(select(Post).where(Post.id == comment.post_id))
        post = post_result.scalar_one_or_none()
        if post and post.comment_count > 0:
            post.comment_count = post.comment_count - 1

        await db.commit()
        return True
