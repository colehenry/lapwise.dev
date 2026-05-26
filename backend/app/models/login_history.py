"""
Login History Model

Tracks login attempts (successful and failed) for security auditing.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class LoginHistory(Base):
    __tablename__ = "login_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id"), index=True, nullable=True
    )  # Nullable for failed logins against unknown users
    ip_address = Column(String, nullable=False)
    user_agent = Column(String, nullable=True)
    success = Column(Boolean, nullable=False)
    failure_reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="login_history")

    def __repr__(self):
        return f"<LoginHistory user_id={self.user_id} success={self.success}>"
