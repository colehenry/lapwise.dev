"""
Replay Data Model

Stores pre-computed race replay frames as compressed binary blobs.
Each row contains all frame data for a single race session, serialized
as MessagePack + gzip (~500KB-2MB per race).
"""

from sqlalchemy import (
    Column,
    Integer,
    Float,
    ForeignKey,
    Index,
    LargeBinary,
    DateTime,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class ReplayData(Base):
    """
    Pre-computed replay frame data for a race session.

    The data column contains a gzip-compressed MessagePack blob with:
    - metadata (session info, fps, frame count)
    - track polyline (normalized [0, 1000] coordinates)
    - driver info (colors, names, numbers)
    - frames array (per-frame driver positions, telemetry, track status)
    - race control messages with timestamps
    """

    __tablename__ = "replay_data"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer,
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # Metadata for queries without loading the blob
    total_frames = Column(Integer, nullable=False)
    total_duration_seconds = Column(Float, nullable=False)
    total_laps = Column(Integer, nullable=False)
    driver_count = Column(Integer, nullable=False)
    compressed_size_bytes = Column(Integer, nullable=False)

    # The replay data (MessagePack + gzip compressed)
    data = Column(LargeBinary, nullable=False)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    session = relationship("Session", back_populates="replay_data")

    __table_args__ = (Index("idx_replay_session", "session_id", unique=True),)

    def __repr__(self):
        return (
            f"<ReplayData session_id={self.session_id} "
            f"frames={self.total_frames} laps={self.total_laps}>"
        )
