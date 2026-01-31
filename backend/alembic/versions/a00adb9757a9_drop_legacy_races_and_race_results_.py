"""drop legacy races and race_results tables

Revision ID: a00adb9757a9
Revises: 6398898cc337
Create Date: 2025-12-14 12:26:02.405002

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a00adb9757a9"
down_revision: Union[str, None] = "6398898cc337"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop legacy tables that have been replaced by sessions/session_results
    # Check if tables exist before dropping them
    conn = op.get_bind()

    # Drop race_results if it exists
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'race_results')"
        )
    )
    if result.scalar():
        op.drop_table("race_results")

    # Drop races if it exists
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'races')"
        )
    )
    if result.scalar():
        op.drop_table("races")


def downgrade() -> None:
    # Note: This will NOT restore your data, only the table structure
    # If you need the data back, restore from a backup

    # Recreate races table
    op.create_table(
        "races",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("season", sa.Integer(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("event_date", sa.DateTime(), nullable=True),
        sa.Column("circuit_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["circuit_id"], ["circuits.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_races_id"), "races", ["id"], unique=False)
    op.create_index(op.f("ix_races_season"), "races", ["season"], unique=False)

    # Recreate race_results table
    op.create_table(
        "race_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("race_id", sa.Integer(), nullable=False),
        sa.Column("driver_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.Column("points", sa.Float(), nullable=True),
        sa.Column("laps", sa.Integer(), nullable=True),
        sa.Column("time", sa.String(), nullable=True),
        sa.Column("fastest_lap", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["race_id"], ["races.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_race_results_id"), "race_results", ["id"], unique=False)
