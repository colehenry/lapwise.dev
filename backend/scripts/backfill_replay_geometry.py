"""Extract existing track geometry without downloading or regenerating telemetry.

Run after the geometry migration:
    PYTHONPATH=. python -m scripts.backfill_replay_geometry [--limit N] [--force]
"""

import argparse
import logging

from app.services.replay_geometry_backfill_service import backfill_track_geometry
from scripts.ingest.utils import get_db_session


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, help="Process at most N replay rows")
    parser.add_argument(
        "--force", action="store_true", help="Rebuild completed artifacts"
    )
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    with get_db_session() as db:
        counts = backfill_track_geometry(db, force=args.force, limit=args.limit)
    logging.info("Geometry backfill: %s", counts)
    return int(counts["failed"] > 0)


if __name__ == "__main__":
    raise SystemExit(main())
