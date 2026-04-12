"""
Session Summary Model

Stores AI-generated summaries for F1 sessions (race, qualifying, practice, sprint).
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class SessionSummary(Base):
    """
    AI-generated summary for an F1 session.

    Each session can have at most one summary. The summary includes
    a narrative text and a JSON array of the top 3 key facts.
    """

    __tablename__ = "session_summaries"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer,
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    summary_text = Column(Text, nullable=False)
    key_facts = Column(Text, nullable=False)  # JSON array
    model_used = Column(String(50), nullable=False)
    tokens_used = Column(Integer, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    post_id = Column(
        Integer,
        ForeignKey("posts.id", ondelete="SET NULL"),
        nullable=True,
    )

    session = relationship("Session", backref="summary")
    post = relationship("Post")

    def __repr__(self):
        return f"<SessionSummary session_id={self.session_id}>"
