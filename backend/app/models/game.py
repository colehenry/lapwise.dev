"""Daily Grid boards and timed play sessions.

A `Puzzle` row is the immutable published board: its answer sets, Rookie Mode
option lists and frozen evidence, plus the editorial state that governs whether
it may be served. It replaces the JSON files under `data/game_puzzles`, which
cannot support daily publication without a deploy.

A `GameSession` is one attempt at one board in one mode. The server owns the
clock: local progress is editable, so a client-measured time cannot rank.
"""

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
)
from sqlalchemy import text as sql_text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

PUZZLE_STATUSES = ("draft", "approved", "published")
GRID_MODES = ("standard", "rookie")
EXIT_REASONS = ("complete", "exhausted", "retired")

DEFAULT_ELIGIBILITY_FLOOR = 1990
BOARD_CELLS = 9


class Puzzle(Base):
    """One frozen board and its editorial state."""

    __tablename__ = "puzzles"

    id = Column(Integer, primary_key=True)
    number = Column(Integer, nullable=False, unique=True)
    public_id = Column(String(40), nullable=False, unique=True)

    status = Column(String(20), nullable=False, server_default="draft")
    published_on = Column(Date, nullable=True)

    answer_version = Column(Integer, nullable=False, server_default="1")
    max_guesses = Column(Integer, nullable=False, server_default="12")
    eligibility_floor = Column(
        Integer, nullable=False, server_default=str(DEFAULT_ELIGIBILITY_FLOOR)
    )

    # Split rather than one snapshot blob: the headers are read on every board
    # load, while `rookie_evidence` runs to hundreds of records per board and is
    # only needed to answer a guess.
    row_categories = Column(JSONB, nullable=False)
    column_categories = Column(JSONB, nullable=False)
    answers = Column(JSONB, nullable=False)
    rookie_options = Column(JSONB, nullable=True)
    rookie_evidence = Column(JSONB, nullable=True)

    difficulty_score = Column(Integer, nullable=True)
    validator_report = Column(JSONB, nullable=True)

    reviewed_by_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sessions = relationship("GameSession", back_populates="puzzle")

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'approved', 'published')",
            name="ck_puzzle_status",
        ),
        # A published board must carry the date it publishes on. Draft and
        # approved boards may sit in the queue undated.
        CheckConstraint(
            "status <> 'published' OR published_on IS NOT NULL",
            name="ck_puzzle_published_has_date",
        ),
        CheckConstraint("max_guesses > 0", name="ck_puzzle_max_guesses"),
        CheckConstraint(
            "eligibility_floor BETWEEN 1950 AND 2100",
            name="ck_puzzle_eligibility_floor",
        ),
        # One board per day, enforced only over published rows so the editorial
        # queue can hold several candidates for the same target date.
        Index(
            "uq_puzzle_published_on",
            "published_on",
            unique=True,
            postgresql_where=sql_text("status = 'published'"),
        ),
        Index("idx_puzzle_schedule", "status", "published_on"),
    )

    def __repr__(self):
        return f"<Puzzle {self.public_id} {self.status}>"


class GameSession(Base):
    """One timed attempt at one board in one mode."""

    __tablename__ = "game_sessions"

    id = Column(Integer, primary_key=True)
    public_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        unique=True,
        server_default=sql_text("gen_random_uuid()"),
    )
    puzzle_id = Column(
        Integer, ForeignKey("puzzles.id", ondelete="RESTRICT"), nullable=False
    )
    mode = Column(String(20), nullable=False)

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Signed-out play still produces a time and still counts toward field size
    # and percentile bands; it simply never appears on a leaderboard.
    anon_id = Column(String(64), nullable=True)

    started_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at = Column(DateTime(timezone=True), nullable=True)
    exit_reason = Column(String(20), nullable=True)

    cells_solved = Column(Integer, nullable=False, server_default="0")
    misses = Column(Integer, nullable=False, server_default="0")
    penalty_seconds = Column(Integer, nullable=False, server_default="0")
    # Written once at the exit. Race time is elapsed plus penalties; storing the
    # elapsed half keeps ranking off a repeated timestamp subtraction.
    elapsed_ms = Column(Integer, nullable=True)

    ranked = Column(Boolean, nullable=False, server_default=sql_text("true"))
    flagged = Column(Boolean, nullable=False, server_default=sql_text("false"))

    puzzle = relationship("Puzzle", back_populates="sessions")
    guesses = relationship(
        "GameSessionGuess", back_populates="session", passive_deletes=True
    )

    __table_args__ = (
        CheckConstraint("mode IN ('standard', 'rookie')", name="ck_game_session_mode"),
        CheckConstraint(
            "exit_reason IS NULL"
            " OR exit_reason IN ('complete', 'exhausted', 'retired')",
            name="ck_game_session_exit_reason",
        ),
        # A finished session is exactly one that recorded how it ended.
        CheckConstraint(
            "(finished_at IS NULL) = (exit_reason IS NULL)",
            name="ck_game_session_finished_pair",
        ),
        CheckConstraint(
            "cells_solved BETWEEN 0 AND 9", name="ck_game_session_cells_solved"
        ),
        CheckConstraint(
            "misses >= 0 AND penalty_seconds >= 0", name="ck_game_session_counters"
        ),
        CheckConstraint(
            "user_id IS NOT NULL OR anon_id IS NOT NULL",
            name="ck_game_session_has_player",
        ),
        # One ranked session per board, mode and player. A restart writes an
        # unranked session instead of replacing this one.
        Index(
            "uq_game_session_ranked_user",
            "puzzle_id",
            "mode",
            "user_id",
            unique=True,
            postgresql_where=sql_text("ranked AND user_id IS NOT NULL"),
        ),
        Index(
            "uq_game_session_ranked_anon",
            "puzzle_id",
            "mode",
            "anon_id",
            unique=True,
            postgresql_where=sql_text("ranked AND anon_id IS NOT NULL"),
        ),
        # Classification order: cells solved first, then race time. Covers the
        # leaderboard and the nightly rollup.
        Index(
            "idx_game_session_leaderboard",
            "puzzle_id",
            "mode",
            sql_text("cells_solved DESC"),
            sql_text("(elapsed_ms + penalty_seconds * 1000) ASC"),
            postgresql_where=sql_text("ranked AND finished_at IS NOT NULL"),
        ),
        Index("idx_game_session_user", "user_id", "started_at"),
    )

    def __repr__(self):
        return f"<GameSession {self.public_id} {self.mode}>"


class GameSessionGuess(Base):
    """One submission, stamped by the server.

    Sector times and per-cell miss history are derived from these rows, and
    they are the submission record rarity scoring waits on.
    """

    __tablename__ = "game_session_guesses"

    id = Column(Integer, primary_key=True)
    session_id = Column(
        Integer, ForeignKey("game_sessions.id", ondelete="CASCADE"), nullable=False
    )
    sequence = Column(Integer, nullable=False)
    row_id = Column(String(80), nullable=False)
    column_id = Column(String(80), nullable=False)
    driver_slug = Column(String(120), nullable=False)
    correct = Column(Boolean, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session = relationship("GameSession", back_populates="guesses")

    __table_args__ = (
        CheckConstraint("sequence > 0", name="ck_game_session_guess_sequence"),
        Index(
            "uq_game_session_guess_sequence",
            "session_id",
            "sequence",
            unique=True,
        ),
        Index("idx_game_session_guess_cell", "session_id", "row_id", "column_id"),
    )

    def __repr__(self):
        return f"<GameSessionGuess {self.session_id}#{self.sequence}>"
