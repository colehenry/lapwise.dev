"""
AI Message Model

Represents a single message in an AI conversation (user, assistant, system, or tool).
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system', 'tool'
    content = Column(Text, nullable=False)
    tool_calls = Column(JSONB, nullable=True)
    tool_results = Column(JSONB, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    model = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    conversation = relationship("AIConversation", back_populates="messages")

    def __repr__(self):
        return f"<AIMessage {self.id} role={self.role}>"
