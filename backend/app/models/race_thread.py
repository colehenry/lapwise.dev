"""
Race Thread Model

One comment thread per race weekend, keyed on (year, round).
"""

from sqlalchemy import Boolean, Column, DateTime, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class RaceThread(Base):
    __tablename__ = "race_threads"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    round = Column(Integer, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    comment_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    comments = relationship("Comment", back_populates="thread")

    __table_args__ = (UniqueConstraint("year", "round", name="uq_race_thread_round"),)

    def __repr__(self):
        return f"<RaceThread {self.year} R{self.round}>"
