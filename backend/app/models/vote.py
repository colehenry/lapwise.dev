"""
Vote Model

Represents an upvote on a comment. One vote per user per comment.
"""

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comment_id = Column(
        Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    comment = relationship("Comment", back_populates="votes")

    __table_args__ = (
        UniqueConstraint("user_id", "comment_id", name="uq_vote_user_comment"),
    )

    def __repr__(self):
        return f"<Vote {self.id} by User {self.user_id} on Comment {self.comment_id}>"
