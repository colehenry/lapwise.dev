"""Build replay artifacts together from one canonical ingestion payload."""

import gzip
import io
from datetime import datetime, timezone

import msgpack

from app.schemas.replay import ReplayTrackGeometry
from app.services.replay_preview import build_preview, preview_stats


def track_geometry_artifact(track: dict | None) -> dict | None:
    """Keep valid geometry at source precision; absence is a processed null."""
    if not track or not track.get("polyline"):
        return None
    return ReplayTrackGeometry.model_validate(track).model_dump(mode="json")


def track_geometry_from_blob(blob: bytes) -> dict | None:
    """Backfill geometry without allocating or decoding the frame array."""
    with gzip.GzipFile(fileobj=io.BytesIO(blob)) as source:
        unpacker = msgpack.Unpacker(source, raw=False)
        for _ in range(unpacker.read_map_header()):
            key = unpacker.unpack()
            if key == "track":
                return track_geometry_artifact(unpacker.unpack())
            unpacker.skip()
    return None


def build_replay_artifacts(payload: dict) -> tuple[bytes, dict]:
    """Serialize the full replay and its small, independently readable artifacts."""
    compressed = gzip.compress(
        msgpack.packb(payload, use_bin_type=True), compresslevel=6
    )
    preview = build_preview(payload)
    stats = preview_stats(preview, payload)
    source = payload["metadata"]
    return compressed, {
        "total_frames": source["total_frames"],
        "total_duration_seconds": source["total_duration_seconds"],
        "total_laps": source["total_laps"],
        "driver_count": len(payload["drivers"]),
        "compressed_size_bytes": len(compressed),
        "preview_data": preview,
        "preview_frames": stats["preview_frames"],
        "preview_fps": stats["preview_fps"],
        "preview_size_bytes": stats["preview_size_bytes"],
        "track_geometry": track_geometry_artifact(payload.get("track")),
        "track_geometry_refreshed_at": datetime.now(timezone.utc),
    }
