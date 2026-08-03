"""
Vote Service

Business logic for upvoting comments.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.vote import Vote


class VoteService:
    @staticmethod
    async def toggle_comment_vote(
        db: AsyncSession, user_id: int, comment_id: int
    ) -> dict:
        comment_result = await db.execute(
            select(Comment).where(
                Comment.id == comment_id, Comment.deleted_at.is_(None)
            )
        )
        comment = comment_result.scalar_one_or_none()
        if not comment:
            raise ValueError("Comment not found")

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
