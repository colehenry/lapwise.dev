"""Add replay preview artifact columns

Revision ID: 9c41ae2f30b8
Revises: 3737b00d5d17
Create Date: 2026-08-03

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9c41ae2f30b8"
down_revision: str | None = "3737b00d5d17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "replay_data", sa.Column("preview_data", sa.LargeBinary(), nullable=True)
    )
    op.add_column(
        "replay_data", sa.Column("preview_frames", sa.Integer(), nullable=True)
    )
    op.add_column("replay_data", sa.Column("preview_fps", sa.Float(), nullable=True))
    op.add_column(
        "replay_data", sa.Column("preview_size_bytes", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("replay_data", "preview_size_bytes")
    op.drop_column("replay_data", "preview_fps")
    op.drop_column("replay_data", "preview_frames")
    op.drop_column("replay_data", "preview_data")
