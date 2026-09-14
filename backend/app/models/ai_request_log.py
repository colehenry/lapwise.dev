"""
AI Request Log Model

One row per Clutch request, for every outcome. Written by the Next.js Clutch
service; the backend owns the schema so migrations stay in one place.
"""

import uuid

from sqlalchemy import Column, DateTime, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


class AIRequestLog(Base):
    __tablename__ = "ai_request_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    user_id = Column(Integer, nullable=True)
    conversation_id = Column(UUID(as_uuid=True), nullable=True)
    message_id = Column(UUID(as_uuid=True), nullable=True)
    question = Column(Text, nullable=False)
    question_hash = Column(String(64), nullable=False)
    page_context = Column(JSONB, nullable=True)
    path = Column(String(20), nullable=True)  # 'deterministic', 'agent'
    analysis_model = Column(String(100), nullable=True)
    upstream_provider = Column(String(100), nullable=True)
    knowledge_nodes = Column(ARRAY(Text), nullable=True)
    topics = Column(ARRAY(Text), nullable=True)
    status = Column(String(20), nullable=False)  # 'ok', 'error', 'aborted', 'rejected'
    stage = Column(String(20), nullable=True)
    error_class = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    http_status = Column(SmallInteger, nullable=True)
    finish_reason = Column(String(40), nullable=True)
    duration_ms = Column(Integer, nullable=False)
    time_to_first_token_ms = Column(Integer, nullable=True)
    model_ms = Column(Integer, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    reasoning_tokens = Column(Integer, nullable=True)
    cached_input_tokens = Column(Integer, nullable=True)
    cost_usd = Column(Numeric(12, 8), nullable=True)
    steps = Column(SmallInteger, nullable=True)
    sql_calls = Column(SmallInteger, nullable=True)
    tool_calls = Column(JSONB, nullable=True)
    service = Column(String(40), nullable=False)  # 'clutch-railway', 'netlify', 'local'
    commit_sha = Column(String(40), nullable=True)
    region = Column(String(40), nullable=True)
    origin = Column(String(200), nullable=True)
    ip_hash = Column(String(64), nullable=True)

    def __repr__(self):
        return f"<AIRequestLog {self.id} status={self.status}>"
