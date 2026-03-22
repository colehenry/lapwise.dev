"""Remove display_name from users table

Revision ID: ff586e6fa509
Revises: 342e013af7b1
Create Date: 2026-03-11 07:29:24.388833

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ff586e6fa509"
down_revision: Union[str, None] = "342e013af7b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "display_name")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "display_name", sa.VARCHAR(length=50), autoincrement=False, nullable=True
        ),
    )
