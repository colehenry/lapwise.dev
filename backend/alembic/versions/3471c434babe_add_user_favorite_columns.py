"""add user favorite columns

Revision ID: 3471c434babe
Revises: ff586e6fa509
Create Date: 2026-03-21 20:04:52.570894

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3471c434babe"
down_revision: Union[str, None] = "ff586e6fa509"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("favorite_driver_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("favorite_team_name", sa.String(), nullable=True))
    op.add_column(
        "users", sa.Column("favorite_circuit_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_users_favorite_driver",
        "users",
        "drivers",
        ["favorite_driver_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_users_favorite_circuit",
        "users",
        "circuits",
        ["favorite_circuit_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_favorite_circuit", "users", type_="foreignkey")
    op.drop_constraint("fk_users_favorite_driver", "users", type_="foreignkey")
    op.drop_column("users", "favorite_circuit_id")
    op.drop_column("users", "favorite_team_name")
    op.drop_column("users", "favorite_driver_id")
