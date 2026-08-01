"""add source column to laps

Revision ID: e2a7c9f41b60
Revises: b4d21c9e7a30
Create Date: 2026-08-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2a7c9f41b60"
down_revision: Union[str, None] = "b4d21c9e7a30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing rows all came from FastF1; server_default backfills them in place.
    op.add_column(
        "laps",
        sa.Column(
            "source",
            sa.String(length=20),
            nullable=False,
            server_default="fastf1",
        ),
    )


def downgrade() -> None:
    op.drop_column("laps", "source")
