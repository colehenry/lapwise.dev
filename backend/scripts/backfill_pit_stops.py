"""
Pit Stop Backfill (2018+)

Derives pit stops for already-ingested FastF1 sessions and writes them to
`pit_stops`. Reads the lap rows in the database, so it needs no FastF1 calls.

Live ingestion calls ingest_pit_stops() directly; this script is for the
one-time pass over sessions ingested before that call existed.

Usage:
    PYTHONPATH=$PWD python scripts/backfill_pit_stops.py
    PYTHONPATH=$PWD python scripts/backfill_pit_stops.py --years 2020-2022
"""

import argparse
import sys

from sqlalchemy import select

from app.models import Session
from scripts.ingest import get_db_session, write_failure_log
from scripts.ingest.pit_stops import PIT_STOP_SESSION_TYPES, ingest_pit_stops


def main():
    parser = argparse.ArgumentParser(description="Derive pit stops for 2018+ sessions")
    parser.add_argument(
        "--years", default="2018-2100", help="Year range, e.g. 2020-2022"
    )
    args = parser.parse_args()

    start_year, _, end_year = args.years.partition("-")
    start_year = int(start_year)
    end_year = int(end_year) if end_year else start_year

    print(f"\n🔧 Deriving pit stops: {start_year}-{end_year}\n")

    db = get_db_session()
    total = 0
    failures = []
    try:
        sessions = (
            db.execute(
                select(Session)
                .where(
                    Session.session_type.in_(PIT_STOP_SESSION_TYPES),
                    Session.year.between(start_year, end_year),
                )
                .order_by(Session.year, Session.round)
            )
            .scalars()
            .all()
        )

        print(f"  📊 {len(sessions)} race and sprint sessions\n")
        for session in sessions:
            label = f"{session.year} R{session.round:02d} {session.session_type}"
            try:
                print(f"  {label}:", end=" ")
                total += ingest_pit_stops(db, session.id)
            except Exception as exc:
                db.rollback()
                failures.append((session.round, label, session.session_type, exc))
                print(f"⚠️  failed: {exc}")
    finally:
        db.close()

    print(f"\n✓ Wrote {total} pit stops")
    if failures:
        write_failure_log(f"pit_stops_{start_year}_{end_year}", failures)
        print(f"⚠️  {len(failures)} sessions logged with problems")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
