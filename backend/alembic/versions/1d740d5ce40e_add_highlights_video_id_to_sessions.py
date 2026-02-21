"""Add highlights_video_id to sessions

Revision ID: 1d740d5ce40e
Revises: 3f8a9b2c1d7e
Create Date: 2026-02-20 01:39:28.287284

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1d740d5ce40e"
down_revision: Union[str, None] = "3f8a9b2c1d7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions", sa.Column("highlights_video_id", sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("sessions", "highlights_video_id")
