"""
Replay Data Ingestion Script

Generates pre-computed race replay frames from FastF1 telemetry and stores
them as compressed blobs in the replay_data table.

Only processes race sessions from 2018+ (FastF1 telemetry requirement).

Usage:
    PYTHONPATH=$PWD python scripts/ingest_replays.py 2024
    PYTHONPATH=$PWD python scripts/ingest_replays.py 2024 5
    PYTHONPATH=$PWD python scripts/ingest_replays.py 2024 --force
"""

import argparse
import os
import sys
import time

import fastf1
from sqlalchemy import select

from app.models import Session as SessionModel, ReplayData
from scripts.ingest import get_db_session, generate_replay_data


def enable_fastf1_cache():
    """Enable FastF1 cache in a consistent location."""
    cache_dir = os.path.abspath(os.path.join(os.getcwd(), ".fastf1_cache"))
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
    fastf1.Cache.enable_cache(cache_dir)
    print(f"💾 Cache enabled at: {cache_dir}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate race replay data from FastF1 telemetry"
    )
    parser.add_argument("season", type=int, help="Season year (2018+)")
    parser.add_argument(
        "round",
        type=int,
        nargs="?",
        default=None,
        help="Specific round number",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate existing replay data",
    )

    args = parser.parse_args()

    if args.season < 2018:
        print("❌ Replay data requires FastF1 telemetry (2018+ only)")
        sys.exit(1)

    enable_fastf1_cache()
    db = get_db_session()

    print(f"\n🏎️  Generating replay data for {args.season}")
    if args.round:
        print(f"   Round: {args.round}")
    print()

    # Get race sessions from database
    query = select(SessionModel).where(
        SessionModel.year == args.season,
        SessionModel.session_type == "race",
    )
    if args.round:
        query = query.where(SessionModel.round == args.round)

    query = query.order_by(SessionModel.round)
    sessions = db.execute(query).scalars().all()

    if not sessions:
        print(f"❌ No race sessions found for {args.season}")
        if args.round:
            print("   (Did you ingest season data first?" " Run ingest_season.py)")
        sys.exit(1)

    print(f"📊 Found {len(sessions)} race session(s)\n")

    success_count = 0
    skip_count = 0
    fail_count = 0
    total_size = 0

    for session in sessions:
        print(f"[R{session.round}] {session.event_name} " f"({session.date})")

        # Check if replay data already exists
        existing = db.execute(
            select(ReplayData).where(ReplayData.session_id == session.id)
        ).scalar_one_or_none()

        if existing and not args.force:
            print(
                f"  ⏭️  Replay data already exists "
                f"({existing.total_frames} frames, "
                f"{existing.compressed_size_bytes / 1024:.0f} KB), skipping"
            )
            skip_count += 1
            total_size += existing.compressed_size_bytes
            print()
            continue

        # Delete existing if --force
        if existing:
            db.delete(existing)
            db.commit()
            print("  🗑️  Deleted existing replay data (--force)")

        # Load FastF1 session with telemetry
        start_time = time.time()
        try:
            print("  📡 Loading FastF1 session (this may take a while)...")
            ff1_session = fastf1.get_session(args.season, session.round, "R")
            ff1_session.load(
                laps=True,
                weather=True,
                messages=True,
                telemetry=True,
            )
        except Exception as e:
            print(f"  ❌ Failed to load FastF1 session: {e}")
            fail_count += 1
            print()
            continue

        load_time = time.time() - start_time
        print(f"  ✓ Loaded in {load_time:.1f}s")

        # Generate replay frames
        try:
            compressed, metadata = generate_replay_data(
                ff1_session,
                session.id,
                args.season,
                session.round,
                session.event_name,
            )

            if compressed is None:
                print("  ❌ Failed to generate replay data")
                fail_count += 1
                print()
                continue

            # Store in database
            replay = ReplayData(
                session_id=session.id,
                total_frames=metadata["total_frames"],
                total_duration_seconds=metadata["total_duration_seconds"],
                total_laps=metadata["total_laps"],
                driver_count=metadata["driver_count"],
                compressed_size_bytes=metadata["compressed_size_bytes"],
                data=compressed,
            )
            db.add(replay)
            db.commit()

            gen_time = time.time() - start_time - load_time
            print(
                f"  ✅ Stored replay data "
                f"({metadata['total_frames']} frames, "
                f"{metadata['compressed_size_bytes'] / 1024:.0f} KB, "
                f"generated in {gen_time:.1f}s)"
            )

            success_count += 1
            total_size += metadata["compressed_size_bytes"]

        except Exception as e:
            print(f"  ❌ Error generating replay: {e}")
            db.rollback()
            fail_count += 1

        print()

    # Summary
    print("=" * 60)
    print(f"✅ Generated: {success_count}")
    print(f"⏭️  Skipped:   {skip_count}")
    print(f"❌ Failed:    {fail_count}")
    print(f"💾 Total size: {total_size / (1024 * 1024):.1f} MB")
    print("=" * 60)

    db.close()


if __name__ == "__main__":
    main()
