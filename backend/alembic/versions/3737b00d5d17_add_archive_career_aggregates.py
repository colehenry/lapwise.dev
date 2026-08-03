"""add archive career aggregates

Rebuildable career totals behind the all-time driver and constructor listings.
Rows are derived from session results and canonical identity, keyed by
canonical id plus the sprint-inclusion variant, and carry `refreshed_at`.
Dropping them loses no source data.

Revision ID: 3737b00d5d17
Revises: e91f6b7c2a10
Create Date: 2026-08-03 01:56:47.331073

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3737b00d5d17"
down_revision: Union[str, None] = "e91f6b7c2a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agg_driver_career",
        sa.Column("driver_id", sa.Integer(), nullable=False),
        sa.Column("include_sprint", sa.Boolean(), nullable=False),
        sa.Column("driver_code", sa.String(), nullable=True),
        sa.Column("driver_slug", sa.String(), nullable=True),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("country_code", sa.String(), nullable=True),
        sa.Column("headshot_url", sa.String(), nullable=True),
        sa.Column("total_wins", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_races", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_podiums", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_points", sa.Float(), server_default="0", nullable=False),
        sa.Column("current_team", sa.String(), nullable=True),
        sa.Column("current_team_color", sa.String(), nullable=True),
        sa.Column("first_season", sa.Integer(), nullable=True),
        sa.Column("latest_season", sa.Integer(), nullable=True),
        sa.Column(
            "refreshed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("driver_id", "include_sprint"),
    )
    op.create_index(
        "idx_agg_driver_career_order",
        "agg_driver_career",
        ["include_sprint", "total_wins", "total_points"],
        unique=False,
    )

    op.create_table(
        "agg_constructor_career",
        sa.Column("constructor_id", sa.Integer(), nullable=False),
        sa.Column("include_sprint", sa.Boolean(), nullable=False),
        sa.Column("team_name", sa.String(), nullable=False),
        sa.Column("constructor_slug", sa.String(), nullable=True),
        sa.Column("team_color", sa.String(), nullable=True),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("total_wins", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_races", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_podiums", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_points", sa.Float(), server_default="0", nullable=False),
        sa.Column("first_season", sa.Integer(), nullable=True),
        sa.Column("latest_season", sa.Integer(), nullable=True),
        sa.Column(
            "refreshed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["constructor_id"], ["constructors.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("constructor_id", "include_sprint"),
    )
    op.create_index(
        "idx_agg_constructor_career_order",
        "agg_constructor_career",
        ["include_sprint", "total_wins", "total_points"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "idx_agg_constructor_career_order", table_name="agg_constructor_career"
    )
    op.drop_table("agg_constructor_career")
    op.drop_index("idx_agg_driver_career_order", table_name="agg_driver_career")
    op.drop_table("agg_driver_career")
