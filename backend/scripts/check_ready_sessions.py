"""
Check Ready Sessions

Checks the F1 calendar to determine if any session has recently ended
and needs ingestion. Designed for GitHub Actions scheduled runs.

Outputs GitHub Actions outputs:
    should_ingest=true/false
    year=YYYY
    round=N
    session_type=race/qualifying/fp1/fp2/fp3/sprint_race/sprint_qualifying

Usage:
    cd backend
    PYTHONPATH=$PWD python scripts/check_ready_sessions.py
"""

import os
import sys
import fastf1
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from scripts.ingest.utils import get_db_session
from app.models import Session, SessionResult

# How long after a session ends before we check for data
MIN_DELAY_HOURS = 1
MAX_DELAY_HOURS = (
    72  # catch sessions FastF1 published late (practice can take hours/days)
)

# FastF1 session columns map to session types
# Standard: S1=FP1, S2=FP2, S3=FP3, S4=Qualifying, S5=Race
# Sprint:   S1=FP1, S2=SprintQualifying, S3=Sprint, S4=Qualifying, S5=Race
SESSION_MAP_STANDARD = {
    "Session1DateUtc": "fp1",
    "Session2DateUtc": "fp2",
    "Session3DateUtc": "fp3",
    "Session4DateUtc": "qualifying",
    "Session5DateUtc": "race",
}

SESSION_MAP_SPRINT = {
    "Session1DateUtc": "fp1",
    "Session2DateUtc": "sprint_qualifying",
    "Session3DateUtc": "sprint_race",
    "Session4DateUtc": "qualifying",
    "Session5DateUtc": "race",
}

# Approximate session durations in hours
SESSION_DURATIONS = {
    "fp1": 1.0,
    "fp2": 1.0,
    "fp3": 1.0,
    "qualifying": 1.5,
    "sprint_qualifying": 0.75,
    "sprint_race": 0.75,
    "race": 2.5,
}


def set_output(key, value):
    """Set a GitHub Actions output variable."""
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a") as f:
            f.write(f"{key}={value}\n")
    print(f"  Output: {key}={value}")


def is_race_weekend(schedule, now):
    """Return True if we're within the active window of any race weekend.

    A race weekend is considered active from Thursday (3 days before race day)
    through 4 hours after the race ends on Sunday.
    """
    for _, event in schedule.iterrows():
        race_col = "Session5DateUtc"
        race_date = event.get(race_col)
        if race_date is None or str(race_date) == "NaT":
            continue
        if hasattr(race_date, "to_pydatetime"):
            race_date = race_date.to_pydatetime()
        if race_date.tzinfo is None:
            race_date = race_date.replace(tzinfo=timezone.utc)

        race_duration = SESSION_DURATIONS["race"]
        weekend_start = race_date - timedelta(days=3)
        weekend_end = race_date + timedelta(
            hours=race_duration + 72
        )  # 72h trailing window for late/missed sessions

        if weekend_start <= now <= weekend_end:
            return True
    return False


def main():
    now = datetime.now(timezone.utc)
    year = now.year

    print(f"Checking for ready sessions at {now.isoformat()}")

    # Enable FastF1 cache
    cache_dir = os.path.abspath(os.path.join(os.getcwd(), ".fastf1_cache"))
    os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)

    # Load schedule
    try:
        schedule = fastf1.get_event_schedule(year)
        schedule = schedule[schedule["EventFormat"] != "testing"]
    except Exception as e:
        print(f"Failed to load schedule: {e}")
        set_output("should_ingest", "false")
        sys.exit(0)

    # Exit early if not a race weekend — avoids unnecessary DB queries on off-weeks
    if not is_race_weekend(schedule, now):
        print("Not a race weekend. Nothing to ingest.")
        set_output("should_ingest", "false")
        sys.exit(0)

    db = get_db_session()
    sessions_to_ingest = []

    for _, event in schedule.iterrows():
        round_num = event["RoundNumber"]
        event_format = event.get("EventFormat", "conventional")

        is_sprint = event_format in (
            "sprint_qualifying",
            "sprint_shootout",
            "sprint",
        )
        session_map = SESSION_MAP_SPRINT if is_sprint else SESSION_MAP_STANDARD

        for date_col, session_type in session_map.items():
            try:
                session_date = event.get(date_col)
                if session_date is None or str(session_date) == "NaT":
                    continue

                # Convert to UTC datetime if needed
                if hasattr(session_date, "to_pydatetime"):
                    session_date = session_date.to_pydatetime()
                if session_date.tzinfo is None:
                    session_date = session_date.replace(tzinfo=timezone.utc)

                # Calculate when session ended
                duration = SESSION_DURATIONS.get(session_type, 1.5)
                session_end = session_date + timedelta(hours=duration)

                # Check if session ended within our window
                time_since_end = (now - session_end).total_seconds() / 3600
                if time_since_end < MIN_DELAY_HOURS or time_since_end > MAX_DELAY_HOURS:
                    continue

                # Check if already ingested
                existing = db.execute(
                    select(func.count())
                    .select_from(SessionResult)
                    .join(Session, SessionResult.session_id == Session.id)
                    .where(
                        Session.year == year,
                        Session.round == round_num,
                        Session.session_type == session_type,
                    )
                ).scalar()

                if existing and existing > 0:
                    print(
                        f"  ✓ Already ingested: R{round_num} {session_type} "
                        f"({existing} results)"
                    )
                    continue

                print(
                    f"  → Ready: R{round_num} {session_type} "
                    f"(ended {time_since_end:.1f}h ago)"
                )
                sessions_to_ingest.append(
                    (year, round_num, session_type, time_since_end)
                )

            except Exception as e:
                print(f"  ⚠ Error checking {date_col} R{round_num}: {e}")
                continue

    db.close()

    if sessions_to_ingest:
        # Pick the session that ended most recently (smallest time_since_end)
        sessions_to_ingest.sort(key=lambda x: x[3])
        year, round_num, session_type, _ = sessions_to_ingest[0]

        set_output("should_ingest", "true")
        set_output("year", str(year))
        set_output("round", str(round_num))
        set_output("session_type", session_type)
        print(f"\nWill ingest: {year} R{round_num} {session_type}")
    else:
        set_output("should_ingest", "false")
        print("\nNo sessions ready for ingestion.")


if __name__ == "__main__":
    main()
