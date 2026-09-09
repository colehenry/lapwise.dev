"""add daily grid puzzles and timed play sessions

`puzzles` moves boards out of `data/game_puzzles/*.json` so a board can publish
on a date without a deploy, and carries the editorial state the scheduler
needs. `game_sessions` and `game_session_guesses` make the clock and the result
server-owned, which is what a leaderboard requires and what the end-of-board
reveal needs to know a board is finished.

Additive only. The JSON files remain on disk until the service is rewired.

Revision ID: a1f3c72d5e84
Revises: b2e7d41c9a35
Create Date: 2026-08-07 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1f3c72d5e84"
down_revision: Union[str, None] = "b2e7d41c9a35"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "puzzles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("public_id", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("published_on", sa.Date(), nullable=True),
        sa.Column("answer_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("max_guesses", sa.Integer(), server_default="12", nullable=False),
        sa.Column(
            "eligibility_floor", sa.Integer(), server_default="1990", nullable=False
        ),
        sa.Column("row_categories", postgresql.JSONB(), nullable=False),
        sa.Column("column_categories", postgresql.JSONB(), nullable=False),
        sa.Column("answers", postgresql.JSONB(), nullable=False),
        sa.Column("rookie_options", postgresql.JSONB(), nullable=True),
        sa.Column("rookie_evidence", postgresql.JSONB(), nullable=True),
        sa.Column("difficulty_score", sa.Integer(), nullable=True),
        sa.Column("validator_report", postgresql.JSONB(), nullable=True),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'approved', 'published')", name="ck_puzzle_status"
        ),
        sa.CheckConstraint(
            "status <> 'published' OR published_on IS NOT NULL",
            name="ck_puzzle_published_has_date",
        ),
        sa.CheckConstraint("max_guesses > 0", name="ck_puzzle_max_guesses"),
        sa.CheckConstraint(
            "eligibility_floor BETWEEN 1950 AND 2100",
            name="ck_puzzle_eligibility_floor",
        ),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("number", name="uq_puzzle_number"),
        sa.UniqueConstraint("public_id", name="uq_puzzle_public_id"),
    )
    # One board per day, over published rows only, so the editorial queue can
    # hold several candidates for the same target date.
    op.create_index(
        "uq_puzzle_published_on",
        "puzzles",
        ["published_on"],
        unique=True,
        postgresql_where=sa.text("status = 'published'"),
    )
    op.create_index("idx_puzzle_schedule", "puzzles", ["status", "published_on"])

    op.create_table(
        "game_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "public_id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("puzzle_id", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("anon_id", sa.String(length=64), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("exit_reason", sa.String(length=20), nullable=True),
        sa.Column("cells_solved", sa.Integer(), server_default="0", nullable=False),
        sa.Column("misses", sa.Integer(), server_default="0", nullable=False),
        sa.Column("penalty_seconds", sa.Integer(), server_default="0", nullable=False),
        sa.Column("elapsed_ms", sa.Integer(), nullable=True),
        sa.Column(
            "ranked", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "flagged", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.CheckConstraint(
            "mode IN ('standard', 'rookie')", name="ck_game_session_mode"
        ),
        sa.CheckConstraint(
            "exit_reason IS NULL"
            " OR exit_reason IN ('complete', 'exhausted', 'retired')",
            name="ck_game_session_exit_reason",
        ),
        sa.CheckConstraint(
            "(finished_at IS NULL) = (exit_reason IS NULL)",
            name="ck_game_session_finished_pair",
        ),
        sa.CheckConstraint(
            "cells_solved BETWEEN 0 AND 9", name="ck_game_session_cells_solved"
        ),
        sa.CheckConstraint(
            "misses >= 0 AND penalty_seconds >= 0", name="ck_game_session_counters"
        ),
        sa.CheckConstraint(
            "user_id IS NOT NULL OR anon_id IS NOT NULL",
            name="ck_game_session_has_player",
        ),
        sa.ForeignKeyConstraint(["puzzle_id"], ["puzzles.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_game_session_public_id"),
    )
    # One ranked session per board, mode and player. A restart writes an
    # unranked session rather than replacing this one.
    op.create_index(
        "uq_game_session_ranked_user",
        "game_sessions",
        ["puzzle_id", "mode", "user_id"],
        unique=True,
        postgresql_where=sa.text("ranked AND user_id IS NOT NULL"),
    )
    op.create_index(
        "uq_game_session_ranked_anon",
        "game_sessions",
        ["puzzle_id", "mode", "anon_id"],
        unique=True,
        postgresql_where=sa.text("ranked AND anon_id IS NOT NULL"),
    )
    op.create_index("idx_game_session_user", "game_sessions", ["user_id", "started_at"])
    # Classification order: cells solved, then race time. Written as SQL because
    # it mixes a descending column with a computed one.
    op.execute(
        "CREATE INDEX idx_game_session_leaderboard ON game_sessions"
        " (puzzle_id, mode, cells_solved DESC,"
        " (elapsed_ms + penalty_seconds * 1000) ASC)"
        " WHERE ranked AND finished_at IS NOT NULL"
    )

    op.create_table(
        "game_session_guesses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("row_id", sa.String(length=80), nullable=False),
        sa.Column("column_id", sa.String(length=80), nullable=False),
        sa.Column("driver_slug", sa.String(length=120), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("sequence > 0", name="ck_game_session_guess_sequence"),
        sa.ForeignKeyConstraint(
            ["session_id"], ["game_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_game_session_guess_sequence",
        "game_session_guesses",
        ["session_id", "sequence"],
        unique=True,
    )
    op.create_index(
        "idx_game_session_guess_cell",
        "game_session_guesses",
        ["session_id", "row_id", "column_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_game_session_guess_cell", table_name="game_session_guesses")
    op.drop_index("uq_game_session_guess_sequence", table_name="game_session_guesses")
    op.drop_table("game_session_guesses")

    op.execute("DROP INDEX IF EXISTS idx_game_session_leaderboard")
    op.drop_index("idx_game_session_user", table_name="game_sessions")
    op.drop_index("uq_game_session_ranked_anon", table_name="game_sessions")
    op.drop_index("uq_game_session_ranked_user", table_name="game_sessions")
    op.drop_table("game_sessions")

    op.drop_index("idx_puzzle_schedule", table_name="puzzles")
    op.drop_index("uq_puzzle_published_on", table_name="puzzles")
    op.drop_table("puzzles")
