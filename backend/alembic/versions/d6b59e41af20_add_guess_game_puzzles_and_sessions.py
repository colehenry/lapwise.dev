"""add guess game puzzles and sessions

Revision ID: d6b59e41af20
Revises: a1f3c72d5e84
Create Date: 2026-09-10 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "d6b59e41af20"
down_revision: Union[str, None] = "a1f3c72d5e84"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "game_session_guesses",
        sa.Column("result_snapshot", postgresql.JSONB(), nullable=True),
    )
    op.create_table(
        "driver_guess_puzzles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("public_id", sa.String(length=40), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column(
            "status", sa.String(length=20), server_default="draft", nullable=False
        ),
        sa.Column("published_on", sa.Date(), nullable=True),
        sa.Column("max_guesses", sa.Integer(), server_default="10", nullable=False),
        sa.Column("answer_driver_id", sa.Integer(), nullable=False),
        sa.Column("answer_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column(
            "fact_algorithm_version", sa.Integer(), server_default="1", nullable=False
        ),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'approved', 'published')",
            name="ck_driver_guess_puzzle_status",
        ),
        sa.CheckConstraint(
            "status <> 'published' OR"
            " (published_on IS NOT NULL AND answer_snapshot IS NOT NULL)",
            name="ck_driver_guess_published_complete",
        ),
        sa.CheckConstraint("max_guesses > 0", name="ck_driver_guess_max_guesses"),
        sa.CheckConstraint(
            "fact_algorithm_version > 0", name="ck_driver_guess_fact_version"
        ),
        sa.ForeignKeyConstraint(
            ["answer_driver_id"], ["drivers.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("number", name="uq_driver_guess_puzzle_number"),
        sa.UniqueConstraint("public_id", name="uq_driver_guess_puzzle_public_id"),
    )
    op.create_index(
        "uq_driver_guess_published_on",
        "driver_guess_puzzles",
        ["published_on"],
        unique=True,
        postgresql_where=sa.text("status = 'published'"),
    )
    op.create_index(
        "idx_driver_guess_puzzle_schedule",
        "driver_guess_puzzles",
        ["status", "published_on"],
    )

    op.create_table(
        "driver_guess_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "public_id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("puzzle_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("anon_id", sa.String(length=64), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("won", sa.Boolean(), nullable=True),
        sa.Column("guesses_used", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "ranked", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column("completion_reason", sa.String(length=20), nullable=True),
        sa.Column("elapsed_ms", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "user_id IS NOT NULL OR anon_id IS NOT NULL",
            name="ck_driver_guess_session_has_player",
        ),
        sa.CheckConstraint(
            "guesses_used >= 0", name="ck_driver_guess_session_guesses_used"
        ),
        sa.CheckConstraint(
            "completion_reason IS NULL"
            " OR completion_reason IN ('won', 'exhausted', 'retired')",
            name="ck_driver_guess_session_completion_reason",
        ),
        sa.CheckConstraint(
            "(finished_at IS NULL) = (completion_reason IS NULL)",
            name="ck_driver_guess_session_finished_pair",
        ),
        sa.ForeignKeyConstraint(
            ["puzzle_id"], ["driver_guess_puzzles.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_driver_guess_session_public_id"),
    )
    op.create_index(
        "uq_driver_guess_session_ranked_user",
        "driver_guess_sessions",
        ["puzzle_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("ranked AND user_id IS NOT NULL"),
    )
    op.create_index(
        "uq_driver_guess_session_ranked_anon",
        "driver_guess_sessions",
        ["puzzle_id", "anon_id"],
        unique=True,
        postgresql_where=sa.text("ranked AND anon_id IS NOT NULL"),
    )
    op.create_index(
        "idx_driver_guess_session_user",
        "driver_guess_sessions",
        ["user_id", "started_at"],
    )
    op.execute(
        "CREATE INDEX idx_driver_guess_leaderboard ON driver_guess_sessions"
        " (puzzle_id, won DESC, guesses_used, elapsed_ms)"
        " WHERE ranked AND finished_at IS NOT NULL"
    )

    op.create_table(
        "driver_guess_guesses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("guessed_driver_id", sa.Integer(), nullable=False),
        sa.Column("comparison_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("selected_fact_id", sa.String(length=120), nullable=False),
        sa.Column("rendered_fact_text", sa.Text(), nullable=False),
        sa.Column("constructor_color", sa.String(length=6), nullable=True),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("sequence > 0", name="ck_driver_guess_sequence"),
        sa.ForeignKeyConstraint(
            ["session_id"], ["driver_guess_sessions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["guessed_driver_id"], ["drivers.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_driver_guess_sequence",
        "driver_guess_guesses",
        ["session_id", "sequence"],
        unique=True,
    )
    op.create_index(
        "uq_driver_guess_driver",
        "driver_guess_guesses",
        ["session_id", "guessed_driver_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_driver_guess_driver", table_name="driver_guess_guesses")
    op.drop_index("uq_driver_guess_sequence", table_name="driver_guess_guesses")
    op.drop_table("driver_guess_guesses")
    op.execute("DROP INDEX IF EXISTS idx_driver_guess_leaderboard")
    op.drop_index("idx_driver_guess_session_user", table_name="driver_guess_sessions")
    op.drop_index(
        "uq_driver_guess_session_ranked_anon", table_name="driver_guess_sessions"
    )
    op.drop_index(
        "uq_driver_guess_session_ranked_user", table_name="driver_guess_sessions"
    )
    op.drop_table("driver_guess_sessions")
    op.drop_index("idx_driver_guess_puzzle_schedule", table_name="driver_guess_puzzles")
    op.drop_index("uq_driver_guess_published_on", table_name="driver_guess_puzzles")
    op.drop_table("driver_guess_puzzles")
    op.drop_column("game_session_guesses", "result_snapshot")
