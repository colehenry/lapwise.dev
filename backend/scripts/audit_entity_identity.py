#!/usr/bin/env python3
"""Read-only audit for the canonical identity and championship rollout."""

from sqlalchemy import text

from scripts.ingest.utils import get_db_session

CHECKS = {
    "open identity issues": """
        SELECT entity_type, source, COALESCE(source_id, '<none>'),
               COALESCE(year::text, '<none>'), details
        FROM ingest_identity_issues WHERE status='open'
        ORDER BY entity_type, year, source_id
    """,
    "ambiguous season driver codes": """
        SELECT year, driver_code, COUNT(*), STRING_AGG(driver_id::text, ',')
        FROM driver_seasons WHERE driver_code IS NOT NULL
        GROUP BY year, driver_code HAVING COUNT(*) > 1
        ORDER BY year, driver_code
    """,
    "ambiguous legacy driver codes": """
        SELECT driver_code, COUNT(DISTINCT driver_id),
               STRING_AGG(DISTINCT driver_id::text, ',' ORDER BY driver_id::text)
        FROM driver_seasons WHERE driver_code IS NOT NULL
        GROUP BY driver_code HAVING COUNT(DISTINCT driver_id) > 1
        ORDER BY driver_code
    """,
    "duplicate constructor seasons": """
        SELECT year, constructor_id, COUNT(*), STRING_AGG(id::text, ',')
        FROM teams GROUP BY year, constructor_id HAVING COUNT(*) > 1
        ORDER BY year, constructor_id
    """,
    "duplicate external driver mappings": """
        SELECT source, external_id, COUNT(DISTINCT driver_id)
        FROM driver_external_ids GROUP BY source, external_id
        HAVING COUNT(DISTINCT driver_id) > 1
    """,
    "duplicate external constructor mappings": """
        SELECT source, external_id, COUNT(DISTINCT constructor_id)
        FROM constructor_external_ids GROUP BY source, external_id
        HAVING COUNT(DISTINCT constructor_id) > 1
    """,
    "duplicate external circuit mappings": """
        SELECT source, external_id, COUNT(DISTINCT venue_id)
        FROM circuit_venue_external_ids GROUP BY source, external_id
        HAVING COUNT(DISTINCT venue_id) > 1
    """,
    "unresolved result identities": """
        SELECT s.year, s.round, COUNT(*)
        FROM session_results sr JOIN sessions s ON s.id=sr.session_id
        LEFT JOIN driver_seasons ds ON ds.driver_id=sr.driver_id AND ds.year=s.year
        LEFT JOIN teams t ON t.id=sr.team_id
        LEFT JOIN constructors c ON c.id=t.constructor_id
        LEFT JOIN circuits l ON l.id=s.circuit_id
        LEFT JOIN circuit_venues v ON v.id=l.venue_id
        WHERE ds.id IS NULL OR c.id IS NULL OR v.id IS NULL
        GROUP BY s.year, s.round ORDER BY s.year, s.round
    """,
    "completed seasons missing final driver standings": """
        SELECT DISTINCT s.year FROM sessions s
        LEFT JOIN driver_championship_standings cs
          ON cs.year=s.year AND cs.is_final
        WHERE s.year < EXTRACT(YEAR FROM CURRENT_DATE) AND cs.id IS NULL
        ORDER BY s.year
    """,
    "completed seasons missing final constructor standings": """
        SELECT DISTINCT s.year FROM sessions s
        LEFT JOIN constructor_championship_standings cs
          ON cs.year=s.year AND cs.is_final
        WHERE s.year BETWEEN 1958 AND EXTRACT(YEAR FROM CURRENT_DATE) - 1
          AND cs.id IS NULL ORDER BY s.year
    """,
    "completed seasons without exactly one driver champion": """
        WITH completed AS (
            SELECT DISTINCT year FROM sessions
            WHERE year < EXTRACT(YEAR FROM CURRENT_DATE)
        ), champions AS (
            SELECT year, COUNT(*) AS champion_count
            FROM driver_championship_standings
            WHERE is_final AND position=1 GROUP BY year
        )
        SELECT completed.year, COALESCE(champions.champion_count, 0)
        FROM completed LEFT JOIN champions USING (year)
        WHERE COALESCE(champions.champion_count, 0) <> 1
        ORDER BY completed.year
    """,
    "completed seasons without exactly one constructor champion": """
        WITH completed AS (
            SELECT DISTINCT year FROM sessions
            WHERE year BETWEEN 1958 AND EXTRACT(YEAR FROM CURRENT_DATE) - 1
        ), champions AS (
            SELECT year, COUNT(*) AS champion_count
            FROM constructor_championship_standings
            WHERE is_final AND position=1 GROUP BY year
        )
        SELECT completed.year, COALESCE(champions.champion_count, 0)
        FROM completed LEFT JOIN champions USING (year)
        WHERE COALESCE(champions.champion_count, 0) <> 1
        ORDER BY completed.year
    """,
    "circuit venues with incomplete race winner history": """
        WITH hosted AS (
            SELECT c.venue_id, COUNT(DISTINCT s.id) AS race_count
            FROM circuits c JOIN sessions s ON s.circuit_id=c.id
            WHERE s.session_type='race' GROUP BY c.venue_id
        ), winners AS (
            SELECT c.venue_id, COUNT(DISTINCT s.id) AS winner_race_count
            FROM circuits c JOIN sessions s ON s.circuit_id=c.id
            JOIN session_results sr ON sr.session_id=s.id AND sr.position=1
            WHERE s.session_type='race' GROUP BY c.venue_id
        )
        SELECT v.slug, hosted.race_count,
               COALESCE(winners.winner_race_count, 0)
        FROM hosted JOIN circuit_venues v ON v.id=hosted.venue_id
        LEFT JOIN winners ON winners.venue_id=hosted.venue_id
        WHERE hosted.race_count <> COALESCE(winners.winner_race_count, 0)
        ORDER BY v.slug
    """,
}

# Reused historical abbreviations are expected after driver codes become
# season-scoped. Legacy routes surface an explicit conflict with slug choices.
INFORMATIONAL_CHECKS = {"ambiguous legacy driver codes"}


def main() -> int:
    db = get_db_session()
    failures = 0
    try:
        for label, query in CHECKS.items():
            rows = db.execute(text(query)).all()
            print(f"\n{label}: {len(rows)}")
            for row in rows[:100]:
                print("  " + " | ".join(str(value) for value in row))
            if rows and label not in INFORMATIONAL_CHECKS:
                failures += 1
    finally:
        db.close()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
