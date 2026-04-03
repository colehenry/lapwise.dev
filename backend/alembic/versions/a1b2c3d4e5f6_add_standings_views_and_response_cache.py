"""add standings views and ai response cache table

Revision ID: a1b2c3d4e5f6
Revises: 83f77547ae09
Create Date: 2026-03-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "83f77547ae09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Driver standings view — aggregates points/wins/podiums per driver per year
    op.execute(
        """
        CREATE OR REPLACE VIEW v_driver_standings AS
        WITH driver_year_team AS (
            SELECT DISTINCT ON (s.year, sr.driver_id)
                s.year,
                sr.driver_id,
                t.name AS team_name
            FROM session_results sr
            JOIN sessions s ON s.id = sr.session_id
            JOIN teams t ON t.id = sr.team_id
            WHERE s.session_type = 'race'
            ORDER BY s.year, sr.driver_id, s.round DESC
        ),
        points_agg AS (
            SELECT
                s.year,
                sr.driver_id,
                COALESCE(SUM(sr.points), 0)                                 AS points,
                COUNT(*) FILTER (WHERE sr.position = 1)                     AS wins,
                COUNT(*) FILTER (WHERE sr.position <= 3)                    AS podiums,
                COUNT(*) FILTER (WHERE sr.position IS NOT NULL)             AS finishes,
                COUNT(*)                                                     AS races_entered
            FROM session_results sr
            JOIN sessions s ON s.id = sr.session_id
            WHERE s.session_type = 'race'
            GROUP BY s.year, sr.driver_id
        )
        SELECT
            pa.year,
            RANK() OVER (PARTITION BY pa.year ORDER BY pa.points DESC, pa.wins DESC)::integer AS championship_position,
            d.full_name     AS driver_name,
            d.driver_code,
            d.country_code,
            dyt.team_name,
            pa.points,
            pa.wins,
            pa.podiums,
            pa.finishes,
            pa.races_entered
        FROM points_agg pa
        JOIN drivers d ON d.id = pa.driver_id
        LEFT JOIN driver_year_team dyt ON dyt.year = pa.year AND dyt.driver_id = pa.driver_id
    """
    )

    # Constructor standings view — aggregates team points/wins per year
    op.execute(
        """
        CREATE OR REPLACE VIEW v_constructor_standings AS
        SELECT
            s.year,
            RANK() OVER (PARTITION BY s.year ORDER BY SUM(sr.points) DESC)::integer AS championship_position,
            t.name          AS team_name,
            t.team_color,
            COALESCE(SUM(sr.points), 0)                                 AS points,
            COUNT(*) FILTER (WHERE sr.position = 1)                     AS wins,
            COUNT(*) FILTER (WHERE sr.position <= 3)                    AS podiums,
            COUNT(*) FILTER (WHERE sr.position IS NOT NULL)             AS finishes
        FROM session_results sr
        JOIN sessions s ON s.id = sr.session_id
        JOIN teams t ON t.id = sr.team_id
        WHERE s.session_type = 'race'
        GROUP BY s.year, t.id, t.name, t.team_color
    """
    )

    # Response cache table — stores pre-generated AI answers for suggestion questions
    op.create_table(
        "ai_response_cache",
        sa.Column("question_hash", sa.Text(), nullable=False),
        sa.Column("response_text", sa.Text(), nullable=False),
        sa.Column("charts_json", postgresql.JSONB(), nullable=True),
        sa.Column("queries_json", postgresql.JSONB(), nullable=True),
        sa.Column("follow_ups_json", postgresql.JSONB(), nullable=True),
        sa.Column(
            "cached_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("question_hash"),
    )


def downgrade() -> None:
    op.drop_table("ai_response_cache")
    op.execute("DROP VIEW IF EXISTS v_constructor_standings")
    op.execute("DROP VIEW IF EXISTS v_driver_standings")
