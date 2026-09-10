"""Coverage for the console's per-driver telemetry slice.

The channels are real but they live inside the replay blob, so these build a
blob of the same shape the ingest writes and assert against what comes back.
"""

import gzip
import struct

import msgpack

from app.services.console_telemetry import (
    TARGET_FPS,
    build_driver_telemetry,
)

SOURCE_FPS = 10


def unpack_i16_deltas(packed: bytes) -> list[int]:
    """Undo the delta encoding, the way the client does."""
    values: list[int] = []
    running = 0
    for (delta,) in struct.iter_unpack("<h", packed):
        running += delta
        values.append(running)
    return values


def build_blob(frames: list[dict], fps: int = SOURCE_FPS) -> bytes:
    """A replay payload shaped exactly like the one ingest stores."""
    return gzip.compress(
        msgpack.packb(
            {
                "metadata": {"fps": fps, "total_frames": len(frames)},
                "track": {"polyline": [[0, 0]], "rotation_deg": 0},
                "drivers": {"LAW": {"color": "0000FF"}},
                "frames": frames,
                "race_control": [],
            },
            use_bin_type=True,
        )
    )


def frame(index: int, entries: dict[str, list]) -> dict:
    return {"t": index / SOURCE_FPS, "lap": 1, "d": entries, "sc": 0}


def car(speed: float, gear: int, throttle: float, brake: int, lap: int) -> list:
    """A driver's eleven-slot frame tuple: x, y, speed, gear, drs, compound,
    tyre life, lap, position, throttle, brake."""
    return [0.0, 0.0, speed, gear, 0, 1, 5, lap, 1, throttle, brake]


def decode(artifact: bytes) -> dict:
    return msgpack.unpackb(gzip.decompress(artifact), raw=False)


def test_the_four_ingested_channels_are_emitted_and_nothing_else():
    frames = [frame(i, {"LAW": car(200 + i, 6, 100, 0, 1)}) for i in range(40)]

    payload = decode(build_driver_telemetry(build_blob(frames), "LAW"))

    assert set(payload) == {
        "v",
        "code",
        "fps",
        "samples",
        "speed",
        "gear",
        "throttle",
        "brake",
        "lap_starts",
    }


def test_the_source_rate_is_downsampled_to_the_target():
    frames = [frame(i, {"LAW": car(200, 6, 100, 0, 1)}) for i in range(40)]

    payload = decode(build_driver_telemetry(build_blob(frames), "LAW"))

    assert payload["fps"] == TARGET_FPS
    # Ten frames a second, kept every other one.
    assert payload["samples"] == 20


def test_speed_survives_above_the_byte_ceiling():
    """A u8 channel would have clipped every straight-line speed to 255."""
    frames = [frame(i, {"LAW": car(340, 8, 100, 0, 1)}) for i in range(20)]

    payload = decode(build_driver_telemetry(build_blob(frames), "LAW"))

    assert max(unpack_i16_deltas(payload["speed"])) == 340


def test_a_car_that_stops_is_cut_rather_than_held():
    """Holding the last reading would draw a retired car still lapping."""
    running = [frame(i, {"LAW": car(200, 6, 100, 0, 1)}) for i in range(20)]
    after = [frame(i, {"OTH": car(200, 6, 100, 0, 1)}) for i in range(20, 200)]

    payload = decode(build_driver_telemetry(build_blob(running + after), "LAW"))

    assert payload["samples"] == 10
    assert len(unpack_i16_deltas(payload["speed"])) == 10


def test_lap_starts_index_the_first_sample_of_each_lap():
    frames = [frame(i, {"LAW": car(200, 6, 100, 0, 1)}) for i in range(20)]
    frames += [frame(i, {"LAW": car(200, 6, 100, 0, 2)}) for i in range(20, 40)]

    payload = decode(build_driver_telemetry(build_blob(frames), "LAW"))

    assert payload["lap_starts"] == [0, 10]


def test_a_driver_who_never_appears_has_no_artifact():
    frames = [frame(i, {"LAW": car(200, 6, 100, 0, 1)}) for i in range(20)]

    assert build_driver_telemetry(build_blob(frames), "NOPE") is None


def test_brake_and_throttle_come_back_as_recorded():
    frames = [frame(i, {"LAW": car(90, 2, 0, 1, 1)}) for i in range(20)]

    payload = decode(build_driver_telemetry(build_blob(frames), "LAW"))

    assert set(payload["throttle"]) == {0}
    assert set(payload["brake"]) == {1}


def test_a_payload_with_no_frames_has_no_artifact():
    assert build_driver_telemetry(build_blob([]), "LAW") is None


def test_a_payload_that_is_not_a_replay_has_no_artifact():
    blob = gzip.compress(msgpack.packb({"metadata": {"fps": 10}}, use_bin_type=True))

    assert build_driver_telemetry(blob, "LAW") is None


def test_the_payload_is_never_decoded_whole(monkeypatch):
    """Streaming is the point: a single `unpackb` of the payload cost 631 MB of
    resident memory per request, which no web process can spend."""
    frames = [frame(i, {"LAW": car(200 + i % 50, 6, 100, 0, 1)}) for i in range(400)]
    blob = build_blob(frames)

    def refuse(*args, **kwargs):
        raise AssertionError("the whole payload was decoded in one go")

    monkeypatch.setattr(
        "app.services.console_telemetry.msgpack.unpackb", refuse, raising=True
    )

    payload = build_driver_telemetry(blob, "LAW")

    assert payload is not None
