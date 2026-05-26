"""
Summary Schemas

Pydantic models for session summary API responses.
"""

from datetime import datetime

from pydantic import BaseModel


class KeyFact(BaseModel):
    headline: str
    detail: str


class SessionSummaryResponse(BaseModel):
    session_type: str
    event_name: str
    summary_text: str
    key_facts: list[KeyFact]
    model_used: str
    generated_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class RoundSummariesResponse(BaseModel):
    year: int
    round: int
    summaries: list[SessionSummaryResponse]
