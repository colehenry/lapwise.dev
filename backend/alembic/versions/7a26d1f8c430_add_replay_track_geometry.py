"""Store replay-backed track geometry separately from frame blobs.

Revision ID: 7a26d1f8c430
Revises: c4e8a9b17d52
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "7a26d1f8c430"
down_revision = "c4e8a9b17d52"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "replay_data",
        sa.Column("track_geometry", postgresql.JSONB(none_as_null=True), nullable=True),
    )
    op.add_column(
        "replay_data",
        sa.Column("track_geometry_refreshed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("replay_data", "track_geometry_refreshed_at")
    op.drop_column("replay_data", "track_geometry")
