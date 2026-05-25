"""rename_ai_queries_today_to_ai_queries_used

Revision ID: c801ab2f58d9
Revises: dafbf351a84a
Create Date: 2026-05-24 19:56:12.648389

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c801ab2f58d9'
down_revision: Union[str, None] = 'dafbf351a84a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "ai_queries_today", new_column_name="ai_queries_used")


def downgrade() -> None:
    op.alter_column("users", "ai_queries_used", new_column_name="ai_queries_today")
