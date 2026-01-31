"""Add pit_duration_seconds computed column

Revision ID: c30bf53f6a6d
Revises: 09410d008af8
Create Date: 2025-12-22 11:43:47.242657

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c30bf53f6a6d"
down_revision: Union[str, None] = "09410d008af8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add computed column for pit stop duration
    # This automatically calculates pit_out_time - pit_in_time
    # Will be NULL for laps without pit stops
    op.execute(
        """
        ALTER TABLE laps
        ADD COLUMN pit_duration_seconds FLOAT
        GENERATED ALWAYS AS (pit_out_time_seconds - pit_in_time_seconds) STORED
    """
    )


def downgrade() -> None:
    # Remove the computed column
    op.drop_column("laps", "pit_duration_seconds")
