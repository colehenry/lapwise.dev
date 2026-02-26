"""
YouTube Highlights Video Ingestion Script

Searches for and stores official F1 highlights video IDs.
Requires yt-dlp to be installed.

Usage:
    PYTHONPATH=$PWD python scripts/ingest_highlights.py 2024        # All rounds
    PYTHONPATH=$PWD python scripts/ingest_highlights.py 2024 5      # Specific round
    PYTHONPATH=$PWD python scripts/ingest_highlights.py --all-seasons
    PYTHONPATH=$PWD python scripts/ingest_highlights.py --all-seasons --overwrite
"""

import sys
from datetime import datetime
from sqlalchemy import select
from scripts.ingest.utils import get_db_session
from scripts.ingest.highlights import ingest_highlights
from app.models.session import Session


def parse_args(argv):
    season = None
    round_num = None
    all_seasons = False
    overwrite = False

    for arg in argv[1:]:
        if arg == "--all-seasons":
            all_seasons = True
        elif arg == "--overwrite":
            overwrite = True
        elif season is None:
            season = int(arg)
        elif round_num is None:
            round_num = int(arg)
        else:
            raise ValueError(f"Unexpected argument: {arg}")

    if season is None and not all_seasons:
        season = datetime.now().year
        print(f"No season specified, defaulting to {season}")

    if round_num is not None and all_seasons:
        raise ValueError("Round filter cannot be combined with --all-seasons")

    return season, round_num, all_seasons, overwrite


def main():
    season, round_num, all_seasons, overwrite = parse_args(sys.argv)

    db = get_db_session()
    try:
        if all_seasons:
            seasons = db.execute(
                select(Session.year).distinct().order_by(Session.year.asc())
            ).scalars()
            seasons = list(seasons)
            print(
                "Ingesting highlights for all seasons: "
                + ", ".join(str(y) for y in seasons)
            )
            print("=" * 50)

            totals = {"found": 0, "skipped": 0, "failed": 0, "no_search": 0}
            for y in seasons:
                print(f"\nSeason {y}")
                summary = ingest_highlights(
                    db, y, round_num=None, overwrite=overwrite
                ) or {
                    "found": 0,
                    "skipped": 0,
                    "failed": 0,
                    "no_search": 0,
                }
                for key in totals:
                    totals[key] += summary.get(key, 0)

            print("\nOverall summary")
            print(
                f"Found={totals['found']}, Skipped={totals['skipped']}, "
                f"NotFound={totals['failed']}, NotApplicable={totals['no_search']}"
            )
        else:
            print(
                f"Ingesting highlights for {season}"
                + (f" round {round_num}" if round_num else " (all rounds)")
            )
            print("=" * 50)
            ingest_highlights(db, season, round_num, overwrite=overwrite)
    finally:
        db.close()


if __name__ == "__main__":
    main()
