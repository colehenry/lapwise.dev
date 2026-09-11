"""Published driver-guess puzzles and immutable play records."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import text as sql_text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class GuessGamePuzzle(Base):
    """One reviewed, frozen mystery-driver puzzle."""

    __tablename__ = "driver_guess_puzzles"

    id = Column(Integer, primary_key=True)
    public_id = Column(String(40), nullable=False, unique=True)
    number = Column(Integer, nullable=False, unique=True)
    status = Column(String(20), nullable=False, server_default="draft")
    published_on = Column(Date, nullable=True)
    max_guesses = Column(Integer, nullable=False, server_default="10")
    answer_driver_id = Column(
        Integer, ForeignKey("drivers.id", ondelete="RESTRICT"), nullable=False
    )
    answer_snapshot = Column(JSONB, nullable=True)
    fact_algorithm_version = Column(Integer, nullable=False, server_default="1")
    reviewed_by_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sessions = relationship("GuessGameSession", back_populates="puzzle")

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'approved', 'published')",
            name="ck_driver_guess_puzzle_status",
        ),
        CheckConstraint(
            "status <> 'published' OR"
            " (published_on IS NOT NULL AND answer_snapshot IS NOT NULL)",
            name="ck_driver_guess_published_complete",
        ),
        CheckConstraint("max_guesses > 0", name="ck_driver_guess_max_guesses"),
        CheckConstraint(
            "fact_algorithm_version > 0",
            name="ck_driver_guess_fact_version",
        ),
        Index(
            "uq_driver_guess_published_on",
            "published_on",
            unique=True,
            postgresql_where=sql_text("status = 'published'"),
        ),
        Index("idx_driver_guess_puzzle_schedule", "status", "published_on"),
    )


class GuessGameSession(Base):
    """One ranked or practice attempt at a driver puzzle."""

    __tablename__ = "driver_guess_sessions"

    id = Column(Integer, primary_key=True)
    public_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        unique=True,
        server_default=sql_text("gen_random_uuid()"),
    )
    puzzle_id = Column(
        Integer,
        ForeignKey("driver_guess_puzzles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    anon_id = Column(String(64), nullable=True)
    started_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at = Column(DateTime(timezone=True), nullable=True)
    won = Column(Boolean, nullable=True)
    guesses_used = Column(Integer, nullable=False, server_default="0")
    ranked = Column(Boolean, nullable=False, server_default=sql_text("true"))
    completion_reason = Column(String(20), nullable=True)
    elapsed_ms = Column(Integer, nullable=True)

    puzzle = relationship("GuessGamePuzzle", back_populates="sessions")
    guesses = relationship(
        "GuessGameGuess",
        back_populates="session",
        passive_deletes=True,
        order_by="GuessGameGuess.sequence",
    )

    __table_args__ = (
        CheckConstraint(
            "user_id IS NOT NULL OR anon_id IS NOT NULL",
            name="ck_driver_guess_session_has_player",
        ),
        CheckConstraint(
            "guesses_used >= 0", name="ck_driver_guess_session_guesses_used"
        ),
        CheckConstraint(
            "completion_reason IS NULL"
            " OR completion_reason IN ('won', 'exhausted', 'retired')",
            name="ck_driver_guess_session_completion_reason",
        ),
        CheckConstraint(
            "(finished_at IS NULL) = (completion_reason IS NULL)",
            name="ck_driver_guess_session_finished_pair",
        ),
        Index(
            "uq_driver_guess_session_ranked_user",
            "puzzle_id",
            "user_id",
            unique=True,
            postgresql_where=sql_text("ranked AND user_id IS NOT NULL"),
        ),
        Index(
            "uq_driver_guess_session_ranked_anon",
            "puzzle_id",
            "anon_id",
            unique=True,
            postgresql_where=sql_text("ranked AND anon_id IS NOT NULL"),
        ),
        Index(
            "idx_driver_guess_leaderboard",
            "puzzle_id",
            sql_text("won DESC"),
            "guesses_used",
            "elapsed_ms",
            postgresql_where=sql_text("ranked AND finished_at IS NOT NULL"),
        ),
        Index("idx_driver_guess_session_user", "user_id", "started_at"),
    )


class GuessGameGuess(Base):
    """One frozen comparison and fact returned for a committed guess."""

    __tablename__ = "driver_guess_guesses"

    id = Column(Integer, primary_key=True)
    session_id = Column(
        Integer,
        ForeignKey("driver_guess_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence = Column(Integer, nullable=False)
    guessed_driver_id = Column(
        Integer, ForeignKey("drivers.id", ondelete="RESTRICT"), nullable=False
    )
    comparison_snapshot = Column(JSONB, nullable=False)
    selected_fact_id = Column(String(120), nullable=False)
    rendered_fact_text = Column(Text, nullable=False)
    constructor_color = Column(String(6), nullable=True)
    correct = Column(Boolean, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session = relationship("GuessGameSession", back_populates="guesses")

    __table_args__ = (
        CheckConstraint("sequence > 0", name="ck_driver_guess_sequence"),
        Index("uq_driver_guess_sequence", "session_id", "sequence", unique=True),
        Index(
            "uq_driver_guess_driver",
            "session_id",
            "guessed_driver_id",
            unique=True,
        ),
    )
