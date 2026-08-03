#!/usr/bin/env python
"""Rebuild the archive career aggregates.

Run after ingestion and after canonical identity or championship updates:

    PYTHONPATH=. python scripts/refresh_archive_aggregates.py

The rebuild is deterministic and transactional — the previous rows stay in
place if it fails, so a partially refreshed archive is never published.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import AsyncSessionLocal  # noqa: E402
from app.services.archive_aggregate_service import (  # noqa: E402
    ArchiveAggregateService,
)


async def main() -> int:
    async with AsyncSessionLocal() as db:
        try:
            counts = await ArchiveAggregateService.rebuild(db)
        except Exception as exc:
            await db.rollback()
            sys.stderr.write(f"archive aggregate refresh failed: {exc}\n")
            return 1

    sys.stdout.write(
        f"archive aggregates refreshed: {counts['drivers']} driver rows, "
        f"{counts['constructors']} constructor rows\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
