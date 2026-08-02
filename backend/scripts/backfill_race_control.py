"""
Race Control Message Backfill (2018+)

Fills `race_control_messages` for sessions ingested before the entrypoints
called ingest_race_control_messages(). Only sessions with no existing messages
are touched, so a re-run is a no-op.

Practice sessions are excluded: the pipeline loads them with messages=False,
so backfilling them would create coverage the live path cannot maintain.

Usage:
    PYTHONPATH=$PWD python scripts/backfill_race_control.py
    PYTHONPATH=$PWD python scripts/backfill_race_control.py --years 2026
    PYTHONPATH=$PWD python scripts/backfill_race_control.py --years 2018-2020
"""

import argparse
import os
import sys

import fastf1
from sqlalchemy import func, select

from app.models import RaceControlMessage, Session
from scripts.ingest import get_db_session, load_session_with_retry, write_failure_log
from scripts.ingest.race_control import ingest_race_control_messages
from scripts.ingest_single import FASTF1_NAMES

BACKFILL_SESSION_TYPES = ["race", "qualifying", "sprint_race", "sprint_qualifying"]


def enable_cache():
    cache_dir = os.path.abspath(os.path.join(os.getcwd(), ".fastf1_cache"))
    os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)


def main():
    parser = argparse.ArgumentParser(
        description="Backfill race control messages for 2018+ sessions"
    )
    parser.add_argument(
        "--years",
        default="2018-2100",
        help="Year or year range, e.g. 2026 or 2018-2020",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="List the gaps without loading FastF1"
    )
    args = parser.parse_args()

    start_year, _, end_year = args.years.partition("-")
    start_year = int(start_year)
    end_year = int(end_year) if end_year else start_year

    print(f"\n📢 Backfilling race control messages: {start_year}-{end_year}\n")

    enable_cache()
    db = get_db_session()
    failures = []
    empty = []
    filled = 0
    try:
        existing = select(RaceControlMessage.session_id).distinct().scalar_subquery()
        sessions = (
            db.execute(
                select(Session)
                .where(
                    Session.year.between(start_year, end_year),
                    Session.year >= 2018,
                    Session.session_type.in_(BACKFILL_SESSION_TYPES),
                    Session.id.notin_(existing),
                )
                .order_by(Session.year, Session.round)
            )
            .scalars()
            .all()
        )

        print(f"  📊 {len(sessions)} sessions without race control messages\n")

        for session in sessions:
            label = f"{session.year} R{session.round:02d} {session.session_type}"
            if args.dry_run:
                print(f"  {label}: would backfill")
                continue

            print(f"  {label}:")
            try:
                # Message timestamps are session-relative only once lap timing is
                # loaded, so this uses the same loader as the ingestion pipeline.
                fastf1_session = load_session_with_retry(
                    session.year, session.round, FASTF1_NAMES[session.session_type]
                )
                if fastf1_session is None:
                    empty.append(label)
                    print("  ⏭️  FastF1 session not available")
                    continue

                ingest_race_control_messages(db, fastf1_session, session.id)
                if db.execute(
                    select(func.count(RaceControlMessage.id)).where(
                        RaceControlMessage.session_id == session.id
                    )
                ).scalar():
                    filled += 1
                else:
                    empty.append(label)
            except Exception as exc:
                db.rollback()
                failures.append((session.round, label, session.session_type, exc))
                print(f"  ⚠️  failed: {exc}")
    finally:
        db.close()

    print(f"\n✓ Populated {filled} sessions")
    if empty:
        # ingest_race_control_messages swallows load errors, so a session with no
        # rows afterwards is reported here rather than counted as a success.
        print(f"ℹ️  {len(empty)} sessions still have no messages: {', '.join(empty)}")
    if failures:
        write_failure_log(f"race_control_{start_year}_{end_year}", failures)
        print(f"⚠️  {len(failures)} sessions logged with problems")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
