"""add session summaries table

Revision ID: dafbf351a84a
Revises: 6f70df6a4841
Create Date: 2026-04-10 23:37:39.591756

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "dafbf351a84a"
down_revision: Union[str, None] = "6f70df6a4841"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "session_summaries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("key_facts", sa.Text(), nullable=False),
        sa.Column("model_used", sa.String(length=50), nullable=False),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("post_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )
    op.create_index(
        op.f("ix_session_summaries_id"), "session_summaries", ["id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_session_summaries_id"), table_name="session_summaries")
    op.drop_table("session_summaries")
