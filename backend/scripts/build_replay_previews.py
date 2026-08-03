"""
Backfill Replay Preview Artifacts

Builds the home autoplay artifact for replay rows ingested before the artifact
existed. Reads one full blob at a time so memory stays bounded: a decoded
replay is ~60 MB.

Usage:
    python -m scripts.build_replay_previews [--force] [--limit N]
"""

import argparse
import gzip
import sys
from pathlib import Path

import msgpack
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.models import ReplayData, Session as SessionModel  # noqa: E402
from app.services.replay_preview import build_preview, preview_stats  # noqa: E402
from scripts.ingest import get_db_session  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill replay preview artifacts")
    parser.add_argument(
        "--force", action="store_true", help="Rebuild rows that already have one"
    )
    parser.add_argument("--limit", type=int, help="Process at most N rows")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    db = get_db_session()

    query = (
        select(ReplayData.id, SessionModel.year, SessionModel.round, SessionModel.event_name)
        .join(SessionModel, SessionModel.id == ReplayData.session_id)
        .order_by(SessionModel.year.desc(), SessionModel.round.desc())
    )
    if not args.force:
        query = query.where(ReplayData.preview_data.is_(None))
    if args.limit:
        query = query.limit(args.limit)

    targets = db.execute(query).all()
    if not targets:
        print("No replay rows need a preview artifact.")
        return 0

    print(f"Building preview artifacts for {len(targets)} replay(s)\n")
    built = 0
    total_bytes = 0

    for replay_id, year, round_num, event_name in targets:
        label = f"{year} R{round_num} {event_name}"
        blob = db.execute(
            select(ReplayData.data).where(ReplayData.id == replay_id)
        ).scalar_one()

        payload = msgpack.unpackb(gzip.decompress(blob), raw=False)
        del blob

        artifact = build_preview(payload)
        stats = preview_stats(artifact, payload)
        del payload

        row = db.execute(
            select(ReplayData).where(ReplayData.id == replay_id)
        ).scalar_one()
        row.preview_data = artifact
        row.preview_frames = stats["preview_frames"]
        row.preview_fps = stats["preview_fps"]
        row.preview_size_bytes = stats["preview_size_bytes"]
        db.commit()

        built += 1
        total_bytes += stats["preview_size_bytes"]
        print(
            f"  ✅ {label}: {stats['preview_size_bytes'] / 1024:.0f} KB "
            f"({stats['source_frames']} -> {stats['preview_frames']} frames)"
        )

    print(f"\nBuilt {built} artifact(s), {total_bytes / 1024 / 1024:.1f} MB total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
