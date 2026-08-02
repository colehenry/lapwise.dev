"""add pit_stops table

Revision ID: f3b81c057d24
Revises: e2a7c9f41b60
Create Date: 2026-08-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3b81c057d24"
down_revision: Union[str, None] = "e2a7c9f41b60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pit_stops",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("driver_id", sa.Integer(), nullable=False),
        sa.Column("lap_number", sa.Integer(), nullable=False),
        sa.Column("stop_number", sa.Integer(), nullable=False),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("local_time", sa.Time(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "session_id", "driver_id", "stop_number", name="uq_session_driver_stop"
        ),
    )
    op.create_index("ix_pit_stops_id", "pit_stops", ["id"])
    op.create_index("ix_pit_stops_session_id", "pit_stops", ["session_id"])
    op.create_index("ix_pit_stops_driver_id", "pit_stops", ["driver_id"])
    op.create_index("idx_pit_session_lap", "pit_stops", ["session_id", "lap_number"])


def downgrade() -> None:
    op.drop_table("pit_stops")
