"""
PostTag Association Table

Many-to-many relationship between posts and tags.
"""

from sqlalchemy import Column, Integer, ForeignKey, Table

from app.database import Base

post_tags = Table(
    "post_tags",
    Base.metadata,
    Column(
        "post_id", Integer, ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True
    ),
    Column(
        "tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    ),
)
