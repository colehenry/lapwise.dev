"""
Vote Service

Business logic for upvoting posts and comments.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vote import Vote
from app.models.post import Post
from app.models.comment import Comment


class VoteService:
    @staticmethod
    async def toggle_post_vote(db: AsyncSession, user_id: int, post_id: int) -> dict:
        # Check post exists
        post_result = await db.execute(
            select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
        )
        post = post_result.scalar_one_or_none()
        if not post:
            raise ValueError("Post not found")

        # Check existing vote
        vote_result = await db.execute(
            select(Vote).where(Vote.user_id == user_id, Vote.post_id == post_id)
        )
        existing_vote = vote_result.scalar_one_or_none()

        if existing_vote:
            # Remove vote
            await db.delete(existing_vote)
            post.vote_count = post.vote_count - 1
            voted = False
        else:
            # Add vote
            vote = Vote(user_id=user_id, post_id=post_id)
            db.add(vote)
            post.vote_count = post.vote_count + 1
            voted = True

        await db.commit()
        return {"voted": voted, "new_count": post.vote_count}

    @staticmethod
    async def toggle_comment_vote(
        db: AsyncSession, user_id: int, comment_id: int
    ) -> dict:
        # Check comment exists
        comment_result = await db.execute(
            select(Comment).where(
                Comment.id == comment_id, Comment.deleted_at.is_(None)
            )
        )
        comment = comment_result.scalar_one_or_none()
        if not comment:
            raise ValueError("Comment not found")

        # Check existing vote
        vote_result = await db.execute(
            select(Vote).where(Vote.user_id == user_id, Vote.comment_id == comment_id)
        )
        existing_vote = vote_result.scalar_one_or_none()

        if existing_vote:
            await db.delete(existing_vote)
            comment.vote_count = comment.vote_count - 1
            voted = False
        else:
            vote = Vote(user_id=user_id, comment_id=comment_id)
            db.add(vote)
            comment.vote_count = comment.vote_count + 1
            voted = True

        await db.commit()
        return {"voted": voted, "new_count": comment.vote_count}

    @staticmethod
    async def get_user_votes(
        db: AsyncSession,
        user_id: int,
        post_ids: list[int] | None = None,
        comment_ids: list[int] | None = None,
    ) -> dict:
        result = {"post_votes": set(), "comment_votes": set()}

        if post_ids:
            vote_result = await db.execute(
                select(Vote.post_id).where(
                    Vote.user_id == user_id, Vote.post_id.in_(post_ids)
                )
            )
            result["post_votes"] = {row[0] for row in vote_result.all()}

        if comment_ids:
            vote_result = await db.execute(
                select(Vote.comment_id).where(
                    Vote.user_id == user_id, Vote.comment_id.in_(comment_ids)
                )
            )
            result["comment_votes"] = {row[0] for row in vote_result.all()}

        return result
