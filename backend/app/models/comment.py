"""
Comment Model

Represents a comment on a discussion post, with optional threading.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    parent_comment_id = Column(
        Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )
    body = Column(Text, nullable=False)
    vote_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    post = relationship("Post", back_populates="comments")
    author = relationship("User")
    replies = relationship(
        "Comment", back_populates="parent", cascade="all, delete-orphan"
    )
    parent = relationship("Comment", back_populates="replies", remote_side=[id])
    votes = relationship("Vote", back_populates="comment")

    def __repr__(self):
        return f"<Comment {self.id} on Post {self.post_id}>"
