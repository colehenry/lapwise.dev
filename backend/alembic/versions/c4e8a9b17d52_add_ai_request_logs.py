"""add ai_request_logs

One row per Clutch request, written for every outcome. `ai_messages` is the
user-facing transcript and only records successful turns; this table is the
operations ledger that answers "what happened to that request".

Additive only.

Revision ID: c4e8a9b17d52
Revises: d6b59e41af20
Create Date: 2026-09-11 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c4e8a9b17d52"
down_revision: Union[str, None] = "d6b59e41af20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_request_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("conversation_id", sa.UUID(), nullable=True),
        sa.Column("message_id", sa.UUID(), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("question_hash", sa.String(length=64), nullable=False),
        sa.Column("page_context", postgresql.JSONB(), nullable=True),
        sa.Column("path", sa.String(length=20), nullable=True),
        sa.Column("analysis_model", sa.String(length=100), nullable=True),
        sa.Column("upstream_provider", sa.String(length=100), nullable=True),
        sa.Column("knowledge_nodes", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("topics", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=True),
        sa.Column("error_class", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("http_status", sa.SmallInteger(), nullable=True),
        sa.Column("finish_reason", sa.String(length=40), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("time_to_first_token_ms", sa.Integer(), nullable=True),
        sa.Column("model_ms", sa.Integer(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("reasoning_tokens", sa.Integer(), nullable=True),
        sa.Column("cached_input_tokens", sa.Integer(), nullable=True),
        sa.Column("cost_usd", sa.Numeric(12, 8), nullable=True),
        sa.Column("steps", sa.SmallInteger(), nullable=True),
        sa.Column("sql_calls", sa.SmallInteger(), nullable=True),
        sa.Column("tool_calls", postgresql.JSONB(), nullable=True),
        sa.Column("service", sa.String(length=40), nullable=False),
        sa.Column("commit_sha", sa.String(length=40), nullable=True),
        sa.Column("region", sa.String(length=40), nullable=True),
        sa.Column("origin", sa.String(length=200), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.CheckConstraint(
            "status IN ('ok', 'error', 'aborted', 'rejected')",
            name="ck_ai_request_logs_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_request_logs_created_at",
        "ai_request_logs",
        [sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_ai_request_logs_user_created",
        "ai_request_logs",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_ai_request_logs_status_created",
        "ai_request_logs",
        ["status", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_ai_request_logs_conversation",
        "ai_request_logs",
        ["conversation_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_request_logs_conversation", table_name="ai_request_logs")
    op.drop_index("ix_ai_request_logs_status_created", table_name="ai_request_logs")
    op.drop_index("ix_ai_request_logs_user_created", table_name="ai_request_logs")
    op.drop_index("ix_ai_request_logs_created_at", table_name="ai_request_logs")
    op.drop_table("ai_request_logs")
