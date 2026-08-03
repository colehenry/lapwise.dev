"""
Test Script for Pre-2018 Data Ingestion

This script verifies that pre-2018 season data can be ingested correctly
without attempting to load telemetry data (laps, weather, track status).

Usage:
    PYTHONPATH=$PWD python scripts/test_pre2018_ingestion.py

This will ingest the 2017 season (last pre-2018 season) to verify:
- Basic session metadata is ingested
- Race and qualifying results are ingested
- Telemetry ingestion is properly skipped
- No errors occur from missing lap/weather/status data

After running, check:
1. Database has 2017 season data
2. session_results table has results (no fastest_lap for races)
3. laps, weather, track_status tables are empty for 2017
4. No errors in the output
"""

import sys
from datetime import datetime

# Use 2017 as test year (last year before telemetry data)
TEST_YEAR = 2017

# Ingest full season (set to None to ingest all rounds)
MAX_ROUNDS = None  # Changed from 2 to None for full season

print(
    f"""
╔══════════════════════════════════════════════════════════╗
║  Pre-2018 Data Ingestion Test                            ║
║  Year: {TEST_YEAR}                                              ║
║  Rounds: Full season                                     ║
╚══════════════════════════════════════════════════════════╝
"""
)

print("This test will:")
print("  ✓ Ingest session metadata (circuits, sessions)")
print("  ✓ Ingest race and qualifying results")
print("  ✓ Skip lap timing data (not available)")
print("  ✓ Skip weather data (not available)")
print("  ✓ Skip track status data (not available)")
print()

# Import the main ingestion script
import fastf1
import os
from scripts.ingest import (
    write_failure_log,
    get_db_session,
    load_session_with_retry,
    session_exists,
    ingest_circuit,
    ingest_session_metadata,
    ingest_race_results,
    ingest_qualifying_results,
)

# Session types (excluding sprint sessions since 2017 didn't have them)
SESSION_TYPES = ["race", "qualifying"]


def enable_fastf1_cache():
    """Enable FastF1 cache in a consistent location."""
    cache_dir = os.path.abspath(os.path.join(os.getcwd(), ".fastf1_cache"))
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
    fastf1.Cache.enable_cache(cache_dir)
    print(f"💾 Cache enabled at: {cache_dir}\n")


def main():
    enable_fastf1_cache()
    db = get_db_session()

    try:
        print(f"📅 Fetching schedule for {TEST_YEAR}...")
        schedule = fastf1.get_event_schedule(TEST_YEAR)
        schedule = schedule[schedule["EventFormat"] != "testing"]

        # Limit rounds if specified
        if MAX_ROUNDS is not None:
            schedule = schedule.head(MAX_ROUNDS)
            print(f"✅ Testing with {len(schedule)} rounds (limited)\n")
        else:
            print(f"✅ Testing with {len(schedule)} rounds (full season)\n")

        failures = []
        successes = 0

        for i, event in schedule.iterrows():
            round_num = event["RoundNumber"]
            event_name = event["EventName"]
            event_date = event["EventDate"]

            print(f"📍 Round {round_num}: {event_name}")

            # 1. Ingest Circuit
            try:
                circuit_id = ingest_circuit(db, event, TEST_YEAR, round_num)
                print(f"  ✓ Circuit ingested")
            except Exception as e:
                print(f"  ❌ Circuit failed: {e}")
                failures.append((round_num, event_name, "circuit", str(e)))
                continue

            # 2. Ingest Sessions
            for session_type in SESSION_TYPES:
                if session_type == "race":
                    fastf1_name = "Race"
                elif session_type == "qualifying":
                    fastf1_name = "Qualifying"
                else:
                    continue

                try:
                    session_date = event_date

                    # Ingest metadata
                    session_id, should_process = ingest_session_metadata(
                        db, event, circuit_id, TEST_YEAR, session_type, session_date
                    )

                    if not should_process:
                        print(f"  ⏭️  {session_type.capitalize()} already exists")
                        continue

                    # Load FastF1 session
                    print(f"  📥 Loading {fastf1_name}...")
                    fastf1_session = load_session_with_retry(
                        TEST_YEAR, round_num, fastf1_name
                    )

                    if fastf1_session is None:
                        print(f"    ⏭️  Session not found")
                        continue

                    # Ingest Results
                    if session_type == "race":
                        ingest_race_results(db, fastf1_session, session_id, TEST_YEAR)
                    elif session_type == "qualifying":
                        ingest_qualifying_results(
                            db, fastf1_session, session_id, TEST_YEAR
                        )

                    print(f"  ✓ {session_type.capitalize()} completed")
                    successes += 1

                except Exception as e:
                    print(f"  ❌ {session_type.capitalize()} failed: {e}")
                    import traceback

                    traceback.print_exc()
                    failures.append((round_num, event_name, session_type, str(e)))

        print("\n" + "=" * 60)
        print(f"✨ Test Complete!")
        print(f"  ✓ Successes: {successes}")
        print(f"  ❌ Failures: {len(failures)}")

        if failures:
            print("\n📝 Failures:")
            for round_num, event_name, session_type, error in failures:
                print(f"  - Round {round_num} {event_name} ({session_type}): {error}")

        write_failure_log(TEST_YEAR, failures)

    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
