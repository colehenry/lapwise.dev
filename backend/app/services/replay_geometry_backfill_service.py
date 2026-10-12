"""Rebuild geometry artifacts from canonical replays, one row at a time."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import ReplayData
from app.services.replay_artifact_service import track_geometry_from_blob

logger = logging.getLogger(__name__)


def backfill_track_geometry(
    db: Session, *, force: bool = False, limit: int | None = None
) -> dict[str, int]:
    """Commit each artifact independently; completed nulls are skipped on rerun.

    A forced replay regeneration deletes and replaces its row. Updating by the
    original id cannot attach an old artifact to that replacement.
    """
    targets = select(ReplayData.id).order_by(ReplayData.id.desc())
    if not force:
        targets = targets.where(ReplayData.track_geometry_refreshed_at.is_(None))
    if limit is not None:
        targets = targets.limit(limit)
    ids = list(db.scalars(targets))
    counts = {"written": 0, "empty": 0, "skipped": 0, "failed": 0}
    for replay_id in ids:
        try:
            blob = db.scalar(select(ReplayData.data).where(ReplayData.id == replay_id))
            if blob is None:
                counts["skipped"] += 1
                db.rollback()
                continue
            geometry = track_geometry_from_blob(blob)
            del blob
            statement = update(ReplayData).where(ReplayData.id == replay_id)
            if not force:
                statement = statement.where(
                    ReplayData.track_geometry_refreshed_at.is_(None)
                )
            result = db.execute(
                statement.values(
                    track_geometry=geometry,
                    track_geometry_refreshed_at=datetime.now(timezone.utc),
                )
            )
            db.commit()
            outcome = (
                "skipped"
                if not result.rowcount
                else "empty"
                if geometry is None
                else "written"
            )
            counts[outcome] += 1
            logger.info("Replay %s geometry: %s", replay_id, outcome)
        except Exception:
            db.rollback()
            counts["failed"] += 1
            logger.exception("Could not backfill geometry for replay %s", replay_id)
    return counts
