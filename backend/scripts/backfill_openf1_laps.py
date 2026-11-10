"""Add OpenF1 timing to a round's sessions that have no lap rows.

A classified session keeps its stored results: OpenF1 carries no starting grid,
so what is already there is the better record.

Usage:
    PYTHONPATH=$PWD python scripts/backfill_openf1_laps.py 2026 19
    PYTHONPATH=$PWD python scripts/backfill_openf1_laps.py 2026 18 --session race
"""

import sys

from sqlalchemy import delete as sql_delete
from sqlalchemy import func, select

from app.models import Lap, RaceControlMessage, Session, SessionResult, Weather
from scripts.ingest import (
    get_db_session,
    ingest_lap_data,
    ingest_openf1_pit_stops,
    ingest_race_control_messages,
    ingest_weather_data,
)
from scripts.ingest.openf1 import load_openf1_session
from scripts.ingest.practice import ingest_openf1_practice_results

RACE_SESSIONS = ("race", "sprint_race")
PRACTICE_SESSIONS = ("fp1", "fp2", "fp3")


def sessions_missing_laps(db, year, round_num, only=None):
    """Sessions of a round with no lap rows, and whether each is classified."""
    rows = db.execute(
        select(Session.id, Session.session_type, Session.date)
        .where(Session.year == year, Session.round == round_num)
        .order_by(Session.session_type)
    ).all()

    pending = []
    for session_id, session_type, session_date in rows:
        if only and session_type != only:
            continue
        results = db.execute(
            select(func.count()).where(SessionResult.session_id == session_id)
        ).scalar()
        laps = db.execute(
            select(func.count()).where(Lap.session_id == session_id)
        ).scalar()
        if not laps:
            pending.append((session_id, session_type, session_date, bool(results)))
    return pending


def backfill(db, year, round_num, session_id, session_type, session_date, classified):
    """Write one session's timing from OpenF1."""
    print(f"\n📥 {year} R{round_num} {session_type}")

    session = load_openf1_session(year, session_date, session_type)
    if session is None:
        print("  ⏭️  OpenF1 has no such session")
        return 0
    if len(session.laps) == 0:
        print("  ⏭️  OpenF1 has no laps for it")
        return 0

    db.execute(sql_delete(Weather).where(Weather.session_id == session_id))
    db.execute(
        sql_delete(RaceControlMessage).where(
            RaceControlMessage.session_id == session_id
        )
    )
    db.commit()

    # Only an unclassified practice session takes its results from OpenF1; a
    # classified one already holds a record with the starting grid.
    if not classified:
        if session_type in PRACTICE_SESSIONS:
            ingest_openf1_practice_results(db, session, session_id, year)
        else:
            print("  ⏭️  Unclassified and not practice; results left to the pipeline")
            return 0

    lap_count = ingest_lap_data(db, session, session_id)

    if session_type in RACE_SESSIONS:
        ingest_openf1_pit_stops(db, session, session_id)
    if session_type not in PRACTICE_SESSIONS:
        ingest_weather_data(db, session, session_id)
        ingest_race_control_messages(db, session, session_id)

    return lap_count


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/backfill_openf1_laps.py <year> <round>")
        sys.exit(1)

    year = int(sys.argv[1])
    round_num = int(sys.argv[2])
    only = None
    if "--session" in sys.argv:
        only = sys.argv[sys.argv.index("--session") + 1]

    db = get_db_session()
    try:
        pending = sessions_missing_laps(db, year, round_num, only=only)
        if not pending:
            print(f"✅ {year} R{round_num}: no session is missing laps")
            return

        print(
            f"🚀 {year} R{round_num}: {len(pending)} session(s) missing laps — "
            + ", ".join(session_type for _, session_type, _, _ in pending)
        )

        total = 0
        for session_id, session_type, session_date, classified in pending:
            total += backfill(
                db,
                year,
                round_num,
                session_id,
                session_type,
                session_date,
                classified,
            )

        print(f"\n✨ {year} R{round_num}: {total} laps written")
    finally:
        db.close()


if __name__ == "__main__":
    main()
