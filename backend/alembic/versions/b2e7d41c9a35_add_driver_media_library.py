"""add driver media library

Owned driver imagery: `media_assets` holds one row per immutable source file
keyed by content hash, with provenance and rights; `driver_media_assignments`
binds an approved asset to a driver and optional season. Additive only —
`session_results.headshot_url` is untouched and remains the legacy path.

Revision ID: b2e7d41c9a35
Revises: 9c41ae2f30b8
Create Date: 2026-08-06 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2e7d41c9a35"
down_revision: Union[str, None] = "9c41ae2f30b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("mime_type", sa.String(length=60), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("source_provider", sa.String(length=60), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("author_name", sa.String(), nullable=True),
        sa.Column("author_url", sa.Text(), nullable=True),
        sa.Column("license_code", sa.String(length=60), nullable=False),
        sa.Column("license_url", sa.Text(), nullable=True),
        sa.Column("attribution_text", sa.Text(), nullable=False),
        sa.Column(
            "rights_status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "rights_status IN ('pending', 'approved', 'restricted', 'removed')",
            name="ck_media_asset_rights_status",
        ),
        sa.CheckConstraint(
            "width > 0 AND height > 0", name="ck_media_asset_dimensions"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key", name="uq_media_asset_storage_key"),
        sa.UniqueConstraint("sha256", name="uq_media_asset_sha256"),
    )
    op.create_index("idx_media_asset_rights", "media_assets", ["rights_status"])

    op.create_table(
        "driver_media_assignments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("driver_id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("media_asset_id", sa.Integer(), nullable=False),
        sa.Column("focal_x", sa.Float(), nullable=True),
        sa.Column("focal_y", sa.Float(), nullable=True),
        sa.Column(
            "visual_grade",
            sa.String(length=20),
            server_default="acceptable",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "role IN ('headshot', 'portrait', 'banner')",
            name="ck_driver_media_role",
        ),
        sa.CheckConstraint(
            "visual_grade IN ('studio', 'clean', 'acceptable', 'poor')",
            name="ck_driver_media_visual_grade",
        ),
        sa.CheckConstraint(
            "(focal_x IS NULL OR (focal_x >= 0 AND focal_x <= 1))"
            " AND (focal_y IS NULL OR (focal_y >= 0 AND focal_y <= 1))",
            name="ck_driver_media_focal_range",
        ),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["driver_id", "year"],
            ["driver_seasons.driver_id", "driver_seasons.year"],
            name="fk_driver_media_season",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["media_asset_id"], ["media_assets.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # One asset per driver-season-role, and one career-wide fallback per role.
    # Split into two partial indexes because NULL year would otherwise defeat a
    # plain unique constraint.
    op.create_index(
        "uq_driver_media_season",
        "driver_media_assignments",
        ["driver_id", "year", "role"],
        unique=True,
        postgresql_where=sa.text("year IS NOT NULL"),
    )
    op.create_index(
        "uq_driver_media_fallback",
        "driver_media_assignments",
        ["driver_id", "role"],
        unique=True,
        postgresql_where=sa.text("year IS NULL"),
    )
    op.create_index(
        "idx_driver_media_lookup",
        "driver_media_assignments",
        ["role", "year", "driver_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_driver_media_lookup", table_name="driver_media_assignments")
    op.drop_index("uq_driver_media_fallback", table_name="driver_media_assignments")
    op.drop_index("uq_driver_media_season", table_name="driver_media_assignments")
    op.drop_table("driver_media_assignments")
    op.drop_index("idx_media_asset_rights", table_name="media_assets")
    op.drop_table("media_assets")
