"""
Tag Model

Represents a discussion tag for categorizing posts.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    slug = Column(String(60), unique=True, nullable=False, index=True)
    color = Column(String(7), nullable=False)  # hex color e.g. "#EF4444"
    category = Column(String(20), nullable=True)  # topic, driver, team, season
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User")
    posts = relationship("Post", secondary="post_tags", back_populates="tags")

    def __repr__(self):
        return f"<Tag {self.slug}>"
