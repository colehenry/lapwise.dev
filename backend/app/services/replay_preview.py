"""
Replay Preview Artifact

Builds the low-frame-rate replay artifact the home page autoplays. The full
replay blob is ~8 MB compressed and ~60 MB decoded; this artifact is ~26x
smaller because it drops telemetry channels, downsamples to PREVIEW_FPS, and
stores coordinates as columnar int16 deltas instead of per-frame dictionaries.

At PREVIEW_SPEED playback the artifact yields 20 position updates per second,
matching the cadence the full blob produced at its own preview speed, so the
player steps samples directly without interpolating.
"""

import gzip
import struct
from typing import Any

import msgpack

PREVIEW_FPS = 2
PREVIEW_SPEED = 10
PREVIEW_FORMAT_VERSION = 1

# Frame slot indices in the full replay payload's per-driver array.
SLOT_X = 0
SLOT_Y = 1
SLOT_LAP = 7

_I16_MIN = -32768
_I16_MAX = 32767
_U8_MAX = 255


def _pack_i16_deltas(values: list[int]) -> bytes:
    """Delta-encode a channel as little-endian int16."""
    out = bytearray()
    previous = 0
    for value in values:
        delta = max(_I16_MIN, min(_I16_MAX, value - previous))
        out += struct.pack("<h", delta)
        previous = value
    return bytes(out)


def _pack_u8(values: list[int]) -> bytes:
    """Pack a channel as unsigned bytes, clamping out-of-range values."""
    return bytes(bytearray(max(0, min(_U8_MAX, value)) for value in values))


def _channel(frames: list[dict], code: str, slot: int) -> list[int]:
    """Read one slot for one driver across frames, holding the last value."""
    values: list[int] = []
    last = 0
    for frame in frames:
        entry = frame["d"].get(code)
        if entry is not None:
            last = round(float(entry[slot]))
        values.append(last)
    return values


def build_preview(payload: dict[str, Any], target_fps: int = PREVIEW_FPS) -> bytes:
    """
    Build the gzip-compressed MessagePack preview artifact for a replay payload.

    `payload` is the decoded full replay dict produced during ingestion.
    """
    frames = payload["frames"]
    source_fps = payload["metadata"]["fps"]
    step = max(1, round(source_fps / target_fps))
    kept = frames[::step]

    codes = sorted({code for frame in kept for code in frame["d"]})

    return gzip.compress(
        msgpack.packb(
            {
                "version": PREVIEW_FORMAT_VERSION,
                "metadata": {
                    **payload["metadata"],
                    "fps": source_fps / step,
                    "total_frames": len(kept),
                },
                "track": payload["track"],
                "drivers": payload["drivers"],
                "codes": codes,
                "x": {c: _pack_i16_deltas(_channel(kept, c, SLOT_X)) for c in codes},
                "y": {c: _pack_i16_deltas(_channel(kept, c, SLOT_Y)) for c in codes},
                "lap": {c: _pack_u8(_channel(kept, c, SLOT_LAP)) for c in codes},
                "sc": _pack_u8([int(frame.get("sc", 0)) for frame in kept]),
            },
            use_bin_type=True,
        ),
        compresslevel=9,
    )


def preview_stats(artifact: bytes, payload: dict[str, Any]) -> dict[str, Any]:
    """Ingestion metadata describing the artifact that was just built."""
    decoded = msgpack.unpackb(gzip.decompress(artifact), raw=False)
    return {
        "preview_size_bytes": len(artifact),
        "preview_frames": decoded["metadata"]["total_frames"],
        "preview_fps": decoded["metadata"]["fps"],
        "source_frames": payload["metadata"]["total_frames"],
    }
