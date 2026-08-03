"""
Comment Service

Business logic for race thread comments.
"""

from datetime import datetime, timezone

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.comment import Comment
from app.models.race_thread import RaceThread
from app.models.session import Session
from app.models.user import User
from app.models.vote import Vote


class CommentService:
    @staticmethod
    async def get_thread(
        db: AsyncSession, year: int, round_num: int
    ) -> RaceThread | None:
        result = await db.execute(
            select(RaceThread).where(
                RaceThread.year == year, RaceThread.round == round_num
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_or_create_thread(
        db: AsyncSession, year: int, round_num: int
    ) -> RaceThread:
        """
        Threads are created on first comment. The round must exist in `sessions`
        so a comment cannot open a thread on a race that was never run.
        """
        thread = await CommentService.get_thread(db, year, round_num)
        if thread:
            return thread

        round_exists = await db.execute(
            select(Session.id)
            .where(Session.year == year, Session.round == round_num)
            .limit(1)
        )
        if not round_exists.scalar_one_or_none():
            raise ValueError("Race not found")

        thread = RaceThread(year=year, round=round_num)
        db.add(thread)
        await db.commit()
        await db.refresh(thread)
        return thread

    @staticmethod
    async def create_comment(
        db: AsyncSession,
        year: int,
        round_num: int,
        author_id: int,
        body: str,
        parent_comment_id: int | None = None,
    ) -> Comment:
        thread = await CommentService.get_or_create_thread(db, year, round_num)
        if thread.is_locked:
            raise PermissionError("Thread is locked")

        if parent_comment_id:
            parent_result = await db.execute(
                select(Comment).where(
                    Comment.id == parent_comment_id,
                    Comment.thread_id == thread.id,
                    Comment.deleted_at.is_(None),
                )
            )
            if not parent_result.scalar_one_or_none():
                raise ValueError("Parent comment not found")

        comment = Comment(
            thread_id=thread.id,
            author_id=author_id,
            body=body,
            parent_comment_id=parent_comment_id,
        )
        db.add(comment)
        thread.comment_count = thread.comment_count + 1

        await db.commit()
        await db.refresh(comment, ["author"])
        return comment

    @staticmethod
    async def get_comments(
        db: AsyncSession,
        year: int,
        round_num: int,
        cursor: str | None = None,
        limit: int = 50,
        sort: str = "new",
        current_user_id: int | None = None,
    ) -> dict:
        thread = await CommentService.get_thread(db, year, round_num)
        if not thread:
            return {
                "comments": [],
                "next_cursor": None,
                "comment_count": 0,
                "is_locked": False,
            }

        query = (
            select(Comment)
            .options(
                selectinload(Comment.author),
                selectinload(Comment.replies).selectinload(Comment.author),
            )
            .where(
                Comment.thread_id == thread.id,
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
                            "thread_id": r.thread_id,
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
                "thread_id": c.thread_id,
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

        return {
            "comments": items,
            "next_cursor": next_cursor,
            "comment_count": thread.comment_count,
            "is_locked": thread.is_locked,
        }

    @staticmethod
    async def get_user_comments(
        db: AsyncSession, username: str, limit: int = 50
    ) -> list:
        """Recent comments by one author, for public profiles."""
        result = await db.execute(
            select(Comment, RaceThread)
            .join(RaceThread, Comment.thread_id == RaceThread.id)
            .join(User, Comment.author_id == User.id)
            .where(User.username == username, Comment.deleted_at.is_(None))
            .order_by(desc(Comment.created_at))
            .limit(limit)
        )

        items = []
        for comment, thread in result.all():
            items.append(
                {
                    "id": comment.id,
                    "body": comment.body,
                    "vote_count": comment.vote_count,
                    "year": thread.year,
                    "round": thread.round,
                    "created_at": comment.created_at,
                }
            )
        return items

    @staticmethod
    async def count_comments(db: AsyncSession, since: datetime | None = None) -> int:
        query = select(func.count(Comment.id)).where(Comment.deleted_at.is_(None))
        if since:
            query = query.where(Comment.created_at >= since)
        result = await db.execute(query)
        return result.scalar() or 0

    @staticmethod
    async def get_admin_comments(
        db: AsyncSession,
        cursor: str | None = None,
        limit: int = 50,
        include_deleted: bool = True,
    ) -> dict:
        query = (
            select(Comment, RaceThread)
            .join(RaceThread, Comment.thread_id == RaceThread.id)
            .options(selectinload(Comment.author))
            .order_by(desc(Comment.created_at))
        )
        if not include_deleted:
            query = query.where(Comment.deleted_at.is_(None))

        if cursor:
            try:
                query = query.where(Comment.id < int(cursor))
            except ValueError:
                pass

        result = await db.execute(query.limit(limit + 1))
        rows = list(result.unique().all())

        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]

        items = []
        for comment, thread in rows:
            items.append(
                {
                    "id": comment.id,
                    "parent_comment_id": comment.parent_comment_id,
                    "body": comment.body,
                    "vote_count": comment.vote_count,
                    "author": comment.author,
                    "year": thread.year,
                    "round": thread.round,
                    "deleted_at": comment.deleted_at,
                    "created_at": comment.created_at,
                    "updated_at": comment.updated_at,
                }
            )

        next_cursor = str(rows[-1][0].id) if has_more and rows else None
        return {"comments": items, "next_cursor": next_cursor}

    @staticmethod
    async def restore_comment(db: AsyncSession, comment_id: int) -> Comment | None:
        result = await db.execute(select(Comment).where(Comment.id == comment_id))
        comment = result.scalar_one_or_none()
        if not comment:
            return None
        comment.deleted_at = None

        thread_result = await db.execute(
            select(RaceThread).where(RaceThread.id == comment.thread_id)
        )
        thread = thread_result.scalar_one_or_none()
        if thread:
            thread.comment_count = thread.comment_count + 1

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

        thread_result = await db.execute(
            select(RaceThread).where(RaceThread.id == comment.thread_id)
        )
        thread = thread_result.scalar_one_or_none()
        if thread and thread.comment_count > 0:
            thread.comment_count = thread.comment_count - 1

        await db.commit()
        return True

    @staticmethod
    async def set_thread_lock(
        db: AsyncSession, year: int, round_num: int, is_locked: bool
    ) -> RaceThread | None:
        thread = await CommentService.get_thread(db, year, round_num)
        if not thread:
            return None
        thread.is_locked = is_locked
        await db.commit()
        await db.refresh(thread)
        return thread
