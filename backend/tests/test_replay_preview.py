"""Tests for the replay preview artifact builder."""

import gzip
import struct

import msgpack
import pytest

from app.services.replay_preview import (
    PREVIEW_FORMAT_VERSION,
    PREVIEW_FPS,
    build_preview,
    preview_stats,
)

SOURCE_FPS = 10
DRIVERS = ["VER", "NOR"]


def make_payload(n_frames: int = 100) -> dict:
    """A synthetic full-replay payload shaped like the ingestion output."""
    frames = []
    for i in range(n_frames):
        frames.append(
            {
                "t": round(i / SOURCE_FPS, 2),
                "lap": 1 + i // 50,
                "sc": 0,
                "d": {
                    code: [
                        100.0 + i + offset,  # 0 x
                        200.0 + i,  # 1 y
                        250.0,  # 2 speed
                        7,  # 3 gear
                        0,  # 4 drs
                        1,  # 5 compound
                        12,  # 6 tyre life
                        1 + i // 50,  # 7 lap
                        1 + offset,  # 8 position
                        95.0,  # 9 throttle
                        0,  # 10 brake
                    ]
                    for offset, code in enumerate(DRIVERS)
                },
            }
        )

    return {
        "metadata": {
            "session_id": 1,
            "season": 2026,
            "round": 11,
            "event_name": "Test Grand Prix",
            "total_frames": n_frames,
            "fps": SOURCE_FPS,
            "total_duration_seconds": n_frames / SOURCE_FPS,
            "total_laps": 2,
            "circuit_length_m": 4094.7,
        },
        "track": {
            "polyline": [[0.0, 0.0], [1.0, 1.0]],
            "rotation_deg": 0,
            "corners": [],
            "drs_zones": [],
        },
        "drivers": {
            code: {
                "color": "FF8000",
                "full_name": code,
                "number": 1,
                "headshot_url": None,
            }
            for code in DRIVERS
        },
        "frames": frames,
        "race_control": [{"t": 0.0, "category": None, "message": "x", "driver_number": None}],
    }


def decode(artifact: bytes) -> dict:
    return msgpack.unpackb(gzip.decompress(artifact), raw=False)


def unpack_i16_deltas(blob: bytes) -> list[int]:
    values = []
    total = 0
    for (delta,) in struct.iter_unpack("<h", blob):
        total += delta
        values.append(total)
    return values


def test_downsamples_to_preview_fps():
    payload = make_payload(100)
    decoded = decode(build_preview(payload))

    assert decoded["metadata"]["fps"] == PREVIEW_FPS
    assert decoded["metadata"]["total_frames"] == 100 // (SOURCE_FPS // PREVIEW_FPS)
    assert decoded["version"] == PREVIEW_FORMAT_VERSION


def test_keeps_position_and_lap_channels_only():
    decoded = decode(build_preview(make_payload()))

    assert set(decoded["x"]) == set(DRIVERS)
    assert set(decoded["y"]) == set(DRIVERS)
    assert set(decoded["lap"]) == set(DRIVERS)
    # Telemetry channels and race control are not part of the artifact.
    assert "frames" not in decoded
    assert "race_control" not in decoded


def test_coordinates_round_trip_through_delta_encoding():
    payload = make_payload(100)
    decoded = decode(build_preview(payload))

    step = SOURCE_FPS // PREVIEW_FPS
    expected_x = [
        round(payload["frames"][i]["d"]["VER"][0]) for i in range(0, 100, step)
    ]
    assert unpack_i16_deltas(decoded["x"]["VER"]) == expected_x


def test_lap_channel_tracks_source_laps():
    payload = make_payload(100)
    decoded = decode(build_preview(payload))

    step = SOURCE_FPS // PREVIEW_FPS
    expected = [payload["frames"][i]["d"]["VER"][7] for i in range(0, 100, step)]
    assert list(decoded["lap"]["VER"]) == expected


def test_track_geometry_stays_full_resolution():
    payload = make_payload()
    decoded = decode(build_preview(payload))

    assert decoded["track"] == payload["track"]
    assert decoded["drivers"] == payload["drivers"]


def test_holds_last_position_for_a_missing_driver():
    payload = make_payload(100)
    for frame in payload["frames"][20:]:
        del frame["d"]["NOR"]

    decoded = decode(build_preview(payload))
    xs = unpack_i16_deltas(decoded["x"]["NOR"])

    # NOR retires after frame 20; the artifact holds its last known position.
    assert len(set(xs[4:])) == 1


def test_artifact_is_far_smaller_than_the_source_blob():
    payload = make_payload(6000)
    artifact = build_preview(payload)
    source = gzip.compress(msgpack.packb(payload, use_bin_type=True), compresslevel=6)

    assert len(artifact) * 5 < len(source)


def test_preview_stats_describe_the_artifact():
    payload = make_payload(100)
    artifact = build_preview(payload)
    stats = preview_stats(artifact, payload)

    assert stats["preview_size_bytes"] == len(artifact)
    assert stats["preview_frames"] == 20
    assert stats["preview_fps"] == PREVIEW_FPS
    assert stats["source_frames"] == 100


@pytest.mark.parametrize("target_fps", [1, 2, 5])
def test_respects_the_requested_frame_rate(target_fps):
    decoded = decode(build_preview(make_payload(100), target_fps=target_fps))
    assert decoded["metadata"]["fps"] == target_fps
