"""
Season Data Ingestion Script

Ingests session data (races, qualifying, sprints) for a given F1 season.
Safe to run multiple times (idempotent) - checks database first, skips existing data.

Requirements:
    - FastF1 3.6.1+ (calculates results from F1 Live Timing API)
    - PYTHONPATH must include backend directory

Usage:
    PYTHONPATH=$PWD python scripts/ingest_season.py
    PYTHONPATH=$PWD python scripts/ingest_season.py 2023  # Specific year
    PYTHONPATH=$PWD python scripts/ingest_season.py 2024 race,qualifying  # Specific session types
    PYTHONPATH=$PWD python scripts/ingest_season.py 2024 --strict  # Fail fast on errors
    PYTHONPATH=$PWD python scripts/ingest_season.py 2024 --skip-highlights  # Skip highlights pass

Features:
    - ⚡ Database-first approach: Checks DB before making expensive FastF1 API calls
    - Automatic retry with exponential backoff for network failures
    - Detailed error reporting and success/failure tracking
    - Absolute cache path for consistent caching
    - Session availability detection (skips non-existent sprint sessions)
    - Optional strict mode (--strict) to fail immediately on errors
    - Optional highlights pass (skip via --skip-highlights)

Schema:
    - sessions: year, round, session_type, event_name, date, circuit_id
    - session_results: Universal fields (position, status) + session-specific fields
      * Race/Sprint: grid_position, points, time_seconds, laps_completed, fastest_lap
      * Qualifying: q1_time_seconds, q2_time_seconds, q3_time_seconds
    - teams: Year-partitioned (unique constraint on year + name)
    - drivers: Year-independent (driver_code unique)

Session Types:
    - race: Main race
    - qualifying: Qualifying session
    - sprint_race: Sprint race (not all events)
    - sprint_qualifying: Sprint qualifying (not all events)

Note:
    FastF1 3.6.1+ calculates results from live timing data since Ergast API
    shutdown in 2024. Earlier versions (3.2.0) will result in NULL values.
"""

import fastf1
import sys
import os
import time
from datetime import datetime

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
    ingest_practice_results,
    ingest_lap_data,
    ingest_pit_stops,
    ingest_weather_data,
    ingest_track_status,
    ingest_race_control_messages,
)
from scripts.ingest.highlights import ingest_highlights


# Session types to ingest (configurable)
DEFAULT_SESSION_TYPES = [
    "fp1",
    "fp2",
    "fp3",
    "race",
    "qualifying",
    "sprint_race",
    "sprint_qualifying",
]


def enable_fastf1_cache():
    """Enable FastF1 cache in a consistent location."""
    # Use absolute path for cache to avoid issues with CWD
    cache_dir = os.path.abspath(os.path.join(os.getcwd(), ".fastf1_cache"))
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
    fastf1.Cache.enable_cache(cache_dir)
    print(f"💾 Cache enabled at: {cache_dir}")


def main():
    if len(sys.argv) < 2:
        # Default to current year if not specified
        season_year = datetime.now().year
        print(f"⚠️  No season specified, defaulting to {season_year}")
    else:
        season_year = int(sys.argv[1])

    # Parse optional arguments
    session_types = DEFAULT_SESSION_TYPES
    strict_mode = False
    skip_highlights = False

    if len(sys.argv) > 2:
        for arg in sys.argv[2:]:
            if arg == "--strict":
                strict_mode = True
            elif arg == "--skip-highlights":
                skip_highlights = True
            elif "," in arg:
                session_types = arg.split(",")
            elif arg in DEFAULT_SESSION_TYPES:
                session_types = [arg]

    print(
        f"🚀 Starting ingestion for {season_year} season (types: {', '.join(session_types)})"
    )
    if strict_mode:
        print("⚠️  STRICT MODE: Will exit on first error")
    if skip_highlights:
        print("ℹ️  Skipping YouTube highlights ingestion")

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

            # Skip future events
            if event_date > datetime.now():
                print(
                    f"⏭️  Skipping future round {round_num}: {event_name} ({event_date.date()})"
                )
                continue

            print(f"\n📍 Round {round_num}: {event_name}")

            # 1. Ingest Circuit (once per event)
            try:
                circuit_id = ingest_circuit(db, event)
            except Exception as e:
                print(f"❌ Failed to ingest circuit for {event_name}: {e}")
                if strict_mode:
                    raise
                failures.append((round_num, event_name, "circuit", str(e)))
                continue  # Can't proceed without circuit

            # 2. Ingest Sessions
            for session_type in session_types:
                # Map session type to FastF1 session identifier
                # FastF1 uses 'Race', 'Qualifying', 'Sprint', 'Sprint Qualifying' (or 'Sprint Shootout' for older years)
                if session_type == "race":
                    fastf1_name = "Race"
                elif session_type == "qualifying":
                    # Qualifying lap times are only available from 1994 onwards via Jolpica.
                    # Pre-1994 qualifying was not timed in a way that's captured in the data.
                    if season_year < 1994:
                        print(
                            f"  ⏭️  Skipping qualifying for {season_year} (data not available pre-1994)"
                        )
                        continue
                    fastf1_name = "Qualifying"
                elif session_type == "sprint_race":
                    fastf1_name = "Sprint"
                elif session_type == "sprint_qualifying":
                    # Handle renaming of sprint shootout -> sprint qualifying
                    # FastF1 handles this fuzzy matching usually, but let's be safe
                    # For 2023 it was Sprint Shootout, 2024+ Sprint Qualifying
                    fastf1_name = "Sprint Qualifying"
                elif session_type == "fp1":
                    fastf1_name = "Practice 1"
                elif session_type == "fp2":
                    fastf1_name = "Practice 2"
                elif session_type == "fp3":
                    fastf1_name = "Practice 3"
                else:
                    continue

                # Check if this session type exists for this event
                if not session_exists(event, session_type):
                    # print(f"  ⏭️  Skipping {session_type} (not part of this event)")
                    continue

                try:
                    # Determine session date based on type
                    # FastF1 event object has attributes like 'Session1Date', 'Session5Date' etc.
                    # This is a simplification; ideally we'd look up the specific session date
                    # but using the event date is safe for sorting for now
                    session_date = event_date

                    # Ingest Session Metadata
                    session_id, should_process = ingest_session_metadata(
                        db, event, circuit_id, season_year, session_type, session_date
                    )

                    if not should_process:
                        continue

                    # Load FastF1 session data
                    is_practice = session_type in ["fp1", "fp2", "fp3"]
                    print(f"  📥 Loading FastF1 data for {fastf1_name}...")
                    fastf1_session = load_session_with_retry(
                        season_year,
                        round_num,
                        fastf1_name,
                        practice=is_practice,
                    )

                    if fastf1_session is None:
                        print(f"    ⏭️  FastF1 session not found (skipping)")
                        continue

                    # Ingest Results
                    if session_type in ["race", "sprint_race"]:
                        ingest_race_results(db, fastf1_session, session_id, season_year)
                    elif session_type in ["qualifying", "sprint_qualifying"]:
                        ingest_qualifying_results(
                            db, fastf1_session, session_id, season_year
                        )
                    elif session_type in ["fp1", "fp2", "fp3"]:
                        ingest_practice_results(
                            db, fastf1_session, session_id, season_year
                        )

                    # Ingest Telemetry (availability depends on era)
                    # Practice: lap data only (skip weather/track status)
                    # 2018+:      Full telemetry from F1 Live Timing API
                    # 1996-2017:  Basic lap times + weather from Jolpica
                    # 1951-1995:  Weather only from Jolpica
                    # pre-1951:   No telemetry available
                    if is_practice:
                        if season_year >= 2018:
                            ingest_lap_data(db, fastf1_session, session_id)
                    elif season_year >= 2018:
                        ingest_lap_data(db, fastf1_session, session_id)
                        ingest_pit_stops(db, session_id)
                        ingest_weather_data(db, fastf1_session, session_id)
                        ingest_track_status(db, fastf1_session, session_id)
                        ingest_race_control_messages(db, fastf1_session, session_id)
                    elif season_year >= 1996:
                        ingest_lap_data(db, fastf1_session, session_id)
                        ingest_weather_data(db, fastf1_session, session_id)
                        print(f"  ℹ️  Track status not available for pre-2018 seasons")
                    elif season_year >= 1951:
                        ingest_weather_data(db, fastf1_session, session_id)
                        print(f"  ℹ️  Lap timing not available for pre-1996 seasons")
                    else:
                        print(f"  ℹ️  No telemetry available for {season_year}")

                except Exception as e:
                    print(f"  ❌ Failed to ingest {session_type} for {event_name}: {e}")
                    import traceback

                    traceback.print_exc()
                    failures.append((round_num, event_name, session_type, str(e)))
                    if strict_mode:
                        raise

        # Write failure log
        write_failure_log(season_year, failures)

        if not skip_highlights:
            print(f"\n🎬 Ingesting highlights for {season_year}...")
            ingest_highlights(db, season_year)

        print("\n✨ Ingestion complete!")

    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
