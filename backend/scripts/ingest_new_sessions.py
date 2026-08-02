"""
Incremental Session Data Ingestion Script

Designed for automated, frequent runs (e.g., GitHub Actions).
1. Defaults to skipping sessions that already have results.
2. Uses a 3-day timing buffer to allow ingestion of early-weekend sessions.
3. Safe to run multiple times (idempotent).

Usage:
    PYTHONPATH=$PWD python scripts/ingest_new_sessions.py
    PYTHONPATH=$PWD python scripts/ingest_new_sessions.py 2026
    PYTHONPATH=$PWD python scripts/ingest_new_sessions.py 2026 --force
    PYTHONPATH=$PWD python scripts/ingest_new_sessions.py 2026 --skip-highlights
"""

import fastf1
import sys
import os
import time
from datetime import datetime, timedelta
from sqlalchemy import select

# Import modular ingestion logic
from scripts.ingest import (
    write_failure_log,
    get_db_session,
    load_session_with_retry,
    session_exists,
    ingest_circuit,
    ingest_session_metadata,
    ingest_race_results,
    ingest_qualifying_results,
    ingest_lap_data,
    ingest_pit_stops,
    ingest_weather_data,
    ingest_track_status,
    ingest_race_control_messages,
)
from scripts.ingest.highlights import ingest_highlights
from app.models import Session, SessionResult


# Session types to ingest (configurable)
DEFAULT_SESSION_TYPES = ["race", "qualifying", "sprint_race", "sprint_qualifying"]


def enable_fastf1_cache():
    """Enable FastF1 cache in a consistent location."""
    cache_dir = os.path.abspath(os.path.join(os.getcwd(), ".fastf1_cache"))
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
    fastf1.Cache.enable_cache(cache_dir)
    print(f"💾 Cache enabled at: {cache_dir}")


def main():
    if len(sys.argv) < 2:
        season_year = datetime.now().year
        print(f"⚠️  No season specified, defaulting to {season_year}")
    else:
        try:
            season_year = int(sys.argv[1])
        except ValueError:
            season_year = datetime.now().year
            print(f"⚠️  Invalid year, defaulting to {season_year}")

    # Parse optional arguments
    force_mode = "--force" in sys.argv
    skip_highlights = "--skip-highlights" in sys.argv
    strict_mode = "--strict" in sys.argv

    print(f"🚀 Starting incremental ingestion for {season_year} season")
    if force_mode:
        print("⚠️  FORCE MODE: Will re-ingest even if results exist")
    else:
        print("ℹ️  INCREMENTAL MODE: Skipping sessions that already have results")

    # Enable cache
    enable_fastf1_cache()

    # Get DB session
    db = get_db_session()

    try:
        # Get season schedule
        print(f"📅 Fetching schedule for {season_year}...")
        schedule = fastf1.get_event_schedule(season_year)

        # Filter out pre-season testing
        schedule = schedule[schedule["EventFormat"] != "testing"]

        print(f"✅ Found {len(schedule)} rounds")

        failures = []

        # Iterate through each round
        for i, event in schedule.iterrows():
            round_num = event["RoundNumber"]
            event_name = event["EventName"]
            event_date = event["EventDate"]

            # Skip future events (with 3-day buffer for early-weekend sessions)
            # F1 events usually have the main race on Sunday (event_date)
            # We want to enter the loop if it's currently Thursday or later of the race week
            if (event_date - timedelta(days=3)) > datetime.now():
                # For very distant future events, keep it quiet
                if (event_date - datetime.now()).days > 14:
                    continue
                print(
                    f"⏭️  Skipping future round {round_num}: {event_name} (starts in {(event_date - datetime.now()).days} days)"
                )
                continue

            print(f"\n📍 Round {round_num}: {event_name}")

            # 1. Ingest Circuit
            try:
                circuit_id = ingest_circuit(db, event)
            except Exception as e:
                print(f"❌ Failed to ingest circuit for {event_name}: {e}")
                failures.append((round_num, event_name, "circuit", str(e)))
                if strict_mode:
                    raise
                continue

            # 2. Ingest Sessions
            for session_type in DEFAULT_SESSION_TYPES:
                # Map session type to FastF1 session identifier
                if session_type == "race":
                    fastf1_name = "Race"
                elif session_type == "qualifying":
                    if season_year < 1994:
                        continue
                    fastf1_name = "Qualifying"
                elif session_type == "sprint_race":
                    fastf1_name = "Sprint"
                elif session_type == "sprint_qualifying":
                    fastf1_name = "Sprint Qualifying"
                else:
                    continue

                # Check if this session type exists for this event
                if not session_exists(event, session_type):
                    continue

                # --- INCREMENTAL CHECK ---
                if not force_mode:
                    # Check if session exists AND has results
                    existing_session = db.execute(
                        select(Session).where(
                            Session.year == season_year,
                            Session.round == round_num,
                            Session.session_type == session_type,
                        )
                    ).scalar_one_or_none()

                    if existing_session:
                        # Check for results
                        has_results = (
                            db.execute(
                                select(SessionResult.id)
                                .where(SessionResult.session_id == existing_session.id)
                                .limit(1)
                            ).scalar()
                            is not None
                        )

                        if has_results:
                            print(f"  ⏭️  Skipping {session_type} (already has results)")
                            continue
                        else:
                            print(
                                f"  ↻ Found incomplete {session_type} (no results), attempting ingestion..."
                            )
                # -------------------------

                try:
                    # Ingest Session Metadata (this wipes if it exists, which is fine since we checked results above)
                    session_id, should_process = ingest_session_metadata(
                        db, event, circuit_id, season_year, session_type, event_date
                    )

                    if not should_process:
                        continue

                    # Load FastF1 session data
                    print(f"  📥 Loading FastF1 data for {fastf1_name}...")
                    fastf1_session = load_session_with_retry(
                        season_year, round_num, fastf1_name
                    )

                    if fastf1_session is None:
                        print(f"    ⏭️  FastF1 data not available yet (skipping)")
                        continue

                    # Ingest Results
                    if session_type in ["race", "sprint_race"]:
                        ingest_race_results(db, fastf1_session, session_id, season_year)
                    elif session_type in ["qualifying", "sprint_qualifying"]:
                        ingest_qualifying_results(
                            db, fastf1_session, session_id, season_year
                        )

                    # Ingest Telemetry
                    if season_year >= 2018:
                        ingest_lap_data(db, fastf1_session, session_id)
                        ingest_pit_stops(db, session_id)
                        ingest_weather_data(db, fastf1_session, session_id)
                        ingest_track_status(db, fastf1_session, session_id)
                        ingest_race_control_messages(db, fastf1_session, session_id)
                    elif season_year >= 1996:
                        ingest_lap_data(db, fastf1_session, session_id)
                        ingest_weather_data(db, fastf1_session, session_id)

                except Exception as e:
                    print(f"  ❌ Failed to ingest {session_type}: {e}")
                    failures.append((round_num, event_name, session_type, str(e)))
                    if strict_mode:
                        raise

        # Write failure log
        write_failure_log(season_year, failures)

        if not skip_highlights:
            print(f"\n🎬 Ingesting highlights for {season_year}...")
            ingest_highlights(db, season_year)

        print("\n✨ Incremental ingestion complete!")

    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
