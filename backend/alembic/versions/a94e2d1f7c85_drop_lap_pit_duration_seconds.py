"""drop laps.pit_duration_seconds

Revision ID: a94e2d1f7c85
Revises: f3b81c057d24
Create Date: 2026-08-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a94e2d1f7c85"
down_revision: Union[str, None] = "f3b81c057d24"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A stop spans two lap rows (PitInTime on the in-lap, PitOutTime on the
    # out-lap), so this generated column never measured one: of the values it
    # produced across every race, exactly one was a plausible duration. The
    # pit_stops table carries the real figure.
    op.drop_column("laps", "pit_duration_seconds")


def downgrade() -> None:
    op.add_column(
        "laps",
        sa.Column(
            "pit_duration_seconds",
            sa.Float(),
            sa.Computed("(pit_out_time_seconds - pit_in_time_seconds)"),
            nullable=True,
        ),
    )
