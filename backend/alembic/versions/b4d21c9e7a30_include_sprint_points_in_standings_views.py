"""include sprint race points in standings views

Revision ID: b4d21c9e7a30
Revises: c801ab2f58d9
Create Date: 2026-08-01

"""

from typing import Sequence, Union

from alembic import op

revision: str = "b4d21c9e7a30"
down_revision: Union[str, None] = "c801ab2f58d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Points sum over race + sprint_race; wins/podiums/finishes/races_entered stay race-only.
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
                COALESCE(SUM(sr.points), 0)                                  AS points,
                COUNT(*) FILTER (
                    WHERE s.session_type = 'race' AND sr.position = 1
                )                                                            AS wins,
                COUNT(*) FILTER (
                    WHERE s.session_type = 'race' AND sr.position <= 3
                )                                                            AS podiums,
                COUNT(*) FILTER (
                    WHERE s.session_type = 'race' AND sr.position IS NOT NULL
                )                                                            AS finishes,
                COUNT(*) FILTER (WHERE s.session_type = 'race')              AS races_entered
            FROM session_results sr
            JOIN sessions s ON s.id = sr.session_id
            WHERE s.session_type IN ('race', 'sprint_race')
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

    op.execute(
        """
        CREATE OR REPLACE VIEW v_constructor_standings AS
        SELECT
            s.year,
            RANK() OVER (PARTITION BY s.year ORDER BY SUM(sr.points) DESC)::integer AS championship_position,
            t.name          AS team_name,
            t.team_color,
            COALESCE(SUM(sr.points), 0)                                  AS points,
            COUNT(*) FILTER (
                WHERE s.session_type = 'race' AND sr.position = 1
            )                                                            AS wins,
            COUNT(*) FILTER (
                WHERE s.session_type = 'race' AND sr.position <= 3
            )                                                            AS podiums,
            COUNT(*) FILTER (
                WHERE s.session_type = 'race' AND sr.position IS NOT NULL
            )                                                            AS finishes
        FROM session_results sr
        JOIN sessions s ON s.id = sr.session_id
        JOIN teams t ON t.id = sr.team_id
        WHERE s.session_type IN ('race', 'sprint_race')
        GROUP BY s.year, t.id, t.name, t.team_color
    """
    )


def downgrade() -> None:
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
