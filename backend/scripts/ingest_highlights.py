"""
YouTube Highlights Video Ingestion Script

Searches for and stores official F1 race highlights video IDs.
Requires yt-dlp to be installed.

Usage:
    PYTHONPATH=$PWD python scripts/ingest_highlights.py 2024        # All rounds
    PYTHONPATH=$PWD python scripts/ingest_highlights.py 2024 5      # Specific round
"""

import sys
from datetime import datetime
from scripts.ingest.utils import get_db_session
from scripts.ingest.highlights import ingest_highlights


def main():
    if len(sys.argv) < 2:
        season = datetime.now().year
        print(f"No season specified, defaulting to {season}")
    else:
        season = int(sys.argv[1])

    round_num = int(sys.argv[2]) if len(sys.argv) > 2 else None

    print(
        f"Ingesting highlights for {season}"
        + (f" round {round_num}" if round_num else " (all rounds)")
    )
    print("=" * 50)

    db = get_db_session()
    try:
        ingest_highlights(db, season, round_num)
    finally:
        db.close()


if __name__ == "__main__":
    main()
