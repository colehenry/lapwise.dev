"""
Single-Session Ingestion Pipeline

Ingests data for one specific session, generates AI summary, and creates
an automated discussion post. Designed for the automated GitHub Actions pipeline.

Uses append-only mode: skips sessions that already have results.
On retry (session exists but no results), wipes and re-ingests.

Usage:
    PYTHONPATH=$PWD python scripts/ingest_single.py 2026 5 race
    PYTHONPATH=$PWD python scripts/ingest_single.py 2026 5 fp1
    PYTHONPATH=$PWD python scripts/ingest_single.py 2026 5 qualifying
    PYTHONPATH=$PWD python scripts/ingest_single.py 2026 6 race --force  # force re-ingest
"""

import sys
import os
import fastf1
from scripts.ingest import (
    get_db_session,
    load_session_with_retry,
    session_exists,
    ingest_circuit,
    ingest_session_metadata,
    ingest_race_results,
    ingest_qualifying_results,
    ingest_practice_results,
    ingest_lap_data,
    ingest_weather_data,
    ingest_track_status,
)
from scripts.ingest.highlights import ingest_highlights
from scripts.ingest.auto_post import create_auto_post
from app.services.summary_service import SummaryService

# FastF1 session name mapping
FASTF1_NAMES = {
    "race": "Race",
    "qualifying": "Qualifying",
    "sprint_race": "Sprint",
    "sprint_qualifying": "Sprint Qualifying",
    "fp1": "Practice 1",
    "fp2": "Practice 2",
    "fp3": "Practice 3",
}


def enable_cache():
    cache_dir = os.path.abspath(os.path.join(os.getcwd(), ".fastf1_cache"))
    os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)


def main():
    if len(sys.argv) < 4:
        print("Usage: python scripts/ingest_single.py <year> <round> <session_type>")
        print(
            "Session types: race, qualifying, sprint_race, sprint_qualifying, fp1, fp2, fp3"
        )
        sys.exit(1)

    year = int(sys.argv[1])
    round_num = int(sys.argv[2])
    session_type = sys.argv[3]
    force = "--force" in sys.argv

    fastf1_name = FASTF1_NAMES.get(session_type)
    if not fastf1_name:
        print(f"Unknown session type: {session_type}")
        sys.exit(1)

    ingest_mode = "override" if force else "append"
    print(f"🚀 Ingesting {year} R{round_num} {session_type}" + (" (force override)" if force else ""))

    enable_cache()
    db = get_db_session()

    try:
        # Load schedule to get event info
        schedule = fastf1.get_event_schedule(year)
        schedule = schedule[schedule["EventFormat"] != "testing"]
        event = schedule[schedule["RoundNumber"] == round_num]

        if event.empty:
            print(f"❌ Round {round_num} not found in {year} schedule")
            sys.exit(1)

        event = event.iloc[0]
        event_name = event["EventName"]
        event_date = event["EventDate"]

        print(f"📍 {event_name}")

        # Check if session type is valid for this event
        if not session_exists(event, session_type):
            print(f"⏭️  {session_type} does not exist for this event")
            sys.exit(0)

        # 1. Ingest circuit
        circuit_id = ingest_circuit(db, event)

        # 2. Ingest session metadata
        session_id, should_process = ingest_session_metadata(
            db, event, circuit_id, year, session_type, event_date, mode=ingest_mode
        )

        if not should_process:
            print("✅ Session already fully ingested, skipping.")
            # Still try summary + post if missing
            _generate_summary_and_post(db, session_id)
            db.close()
            return

        # 3. Load FastF1 data
        is_practice = session_type in ("fp1", "fp2", "fp3")
        print(f"  📥 Loading FastF1 data for {fastf1_name}...")
        fastf1_session = load_session_with_retry(
            year, round_num, fastf1_name, practice=is_practice
        )

        if fastf1_session is None:
            print("  ❌ FastF1 session data not available yet")
            sys.exit(1)

        # 4. Ingest results
        if session_type in ("race", "sprint_race"):
            ingest_race_results(db, fastf1_session, session_id, year)
        elif session_type in ("qualifying", "sprint_qualifying"):
            ingest_qualifying_results(db, fastf1_session, session_id, year)
        elif session_type in ("fp1", "fp2", "fp3"):
            ingest_practice_results(db, fastf1_session, session_id, year)

        # 5. Ingest telemetry (era-dependent)
        if is_practice:
            if year >= 2018:
                ingest_lap_data(db, fastf1_session, session_id)
        elif year >= 2018:
            ingest_lap_data(db, fastf1_session, session_id)
            ingest_weather_data(db, fastf1_session, session_id)
            ingest_track_status(db, fastf1_session, session_id)
        elif year >= 1996:
            ingest_lap_data(db, fastf1_session, session_id)
            ingest_weather_data(db, fastf1_session, session_id)

        # 6. Ingest highlights for this round
        print("  🎬 Searching for highlights...")
        ingest_highlights(db, year, round_num=round_num)

        # 7. Generate summary + auto-post
        _generate_summary_and_post(db, session_id)

        print("\n✨ Pipeline complete!")

    except Exception as e:
        print(f"\n❌ Pipeline error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


def _generate_summary_and_post(db, session_id):
    """Generate AI summary and create auto-post if not already done."""
    print("  🤖 Generating AI summary...")
    summary = SummaryService.generate_summary(db, session_id)

    if summary and not summary.post_id:
        print("  📝 Creating discussion post...")
        create_auto_post(db, session_id, summary)
    elif summary and summary.post_id:
        print(f"  ✓ Post already exists (post_id={summary.post_id})")
    else:
        print("  ℹ️  No summary generated (API key may not be set)")


if __name__ == "__main__":
    main()
