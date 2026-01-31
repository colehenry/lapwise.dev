"""Increase compound field length for INTERMEDIATE tyres

Revision ID: 09410d008af8
Revises: fb3475803d53
Create Date: 2025-12-22 11:26:39.302248

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "09410d008af8"
down_revision: Union[str, None] = "fb3475803d53"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Increase compound field from VARCHAR(10) to VARCHAR(15) to handle "INTERMEDIATE"
    op.alter_column(
        "laps",
        "compound",
        existing_type=sa.String(length=10),
        type_=sa.String(length=15),
        existing_nullable=True,
    )


def downgrade() -> None:
    # Revert back to VARCHAR(10)
    op.alter_column(
        "laps",
        "compound",
        existing_type=sa.String(length=15),
        type_=sa.String(length=10),
        existing_nullable=True,
    )
