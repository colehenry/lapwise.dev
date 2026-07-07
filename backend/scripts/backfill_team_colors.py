"""
Backfill Team Colors for Historical Seasons

This script updates existing teams in the database that have NULL team_color
by applying the historical team color mapping.

Usage:
    PYTHONPATH=$PWD python scripts/backfill_team_colors.py
    PYTHONPATH=$PWD python scripts/backfill_team_colors.py 2017  # Specific year
    PYTHONPATH=$PWD python scripts/backfill_team_colors.py 1950 2017  # Year range
"""

import sys
from sqlalchemy import select, update
from app.models import Team
from scripts.ingest.utils import get_db_session
from scripts.ingest.team_colors import get_historical_team_color


def backfill_team_colors(start_year=None, end_year=None):
    """
    Backfill team colors for teams with NULL color values.

    Args:
        start_year: Optional start year filter
        end_year: Optional end year filter
    """
    db = get_db_session()

    try:
        # Build query
        query = select(Team).where(Team.team_color.is_(None))

        if start_year and end_year:
            query = query.where(Team.year >= start_year, Team.year <= end_year)
        elif start_year:
            query = query.where(Team.year == start_year)

        query = query.order_by(Team.year, Team.name)

        # Fetch teams without colors
        result = db.execute(query)
        teams = result.scalars().all()

        if not teams:
            print("✅ No teams found with missing colors.")
            return

        print(f"Found {len(teams)} teams with missing colors\n")

        updated = 0
        not_found = 0

        for team in teams:
            # Try to get historical color
            color = get_historical_team_color(team.name)

            if color:
                print(f"✓ {team.year} {team.name}: {color}")
                team.team_color = color
                updated += 1
            else:
                print(f"⚠ {team.year} {team.name}: No historical color found")
                not_found += 1

        # Commit changes
        db.commit()

        print(f"\n{'=' * 60}")
        print(f"✨ Backfill complete!")
        print(f"  Updated: {updated}")
        print(f"  Not found: {not_found}")
        print(f"{'=' * 60}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def main():
    if len(sys.argv) == 1:
        # No arguments - update all years
        print("Backfilling team colors for all seasons...\n")
        backfill_team_colors()
    elif len(sys.argv) == 2:
        # Single year
        year = int(sys.argv[1])
        print(f"Backfilling team colors for {year}...\n")
        backfill_team_colors(start_year=year)
    elif len(sys.argv) == 3:
        # Year range
        start = int(sys.argv[1])
        end = int(sys.argv[2])
        print(f"Backfilling team colors for {start}-{end}...\n")
        backfill_team_colors(start_year=start, end_year=end)
    else:
        print("Usage:")
        print("  PYTHONPATH=$PWD python scripts/backfill_team_colors.py")
        print("  PYTHONPATH=$PWD python scripts/backfill_team_colors.py 2017")
        print("  PYTHONPATH=$PWD python scripts/backfill_team_colors.py 1950 2017")
        sys.exit(1)


if __name__ == "__main__":
    main()
