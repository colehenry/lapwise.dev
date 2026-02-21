"""Add jolpica_id to drivers, make driver_code nullable

Revision ID: 3f8a9b2c1d7e
Revises: 09410d008af8
Create Date: 2026-02-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3f8a9b2c1d7e"
down_revision: Union[str, None] = "c30bf53f6a6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add jolpica_id column (Jolpica/Ergast stable driver identifier)
    op.add_column("drivers", sa.Column("jolpica_id", sa.String(), nullable=True))
    op.create_unique_constraint("uq_drivers_jolpica_id", "drivers", ["jolpica_id"])
    op.create_index("ix_drivers_jolpica_id", "drivers", ["jolpica_id"])

    # 2. Make driver_code nullable (pre-2003 drivers have no official 3-letter code)
    op.alter_column(
        "drivers", "driver_code", existing_type=sa.String(length=3), nullable=True
    )

    # 3. Clean up "nan" driver codes left by broken historical ingestion
    #    These are ghost records where all pre-2003 drivers collapsed into one.
    #    Set their code to NULL so re-ingestion can create proper records.
    op.execute("UPDATE drivers SET driver_code = NULL WHERE driver_code = 'nan'")


def downgrade() -> None:
    # Restore driver_code as NOT NULL (requires all rows to have a code first)
    op.execute("UPDATE drivers SET driver_code = 'UNK' WHERE driver_code IS NULL")
    op.alter_column(
        "drivers", "driver_code", existing_type=sa.String(length=3), nullable=False
    )

    # Drop jolpica_id
    op.drop_index("ix_drivers_jolpica_id", table_name="drivers")
    op.drop_constraint("uq_drivers_jolpica_id", "drivers", type_="unique")
    op.drop_column("drivers", "jolpica_id")
