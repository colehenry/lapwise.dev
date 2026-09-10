"""
Console Telemetry Slice

The channels the homepage console draws for one driver: speed, gear, throttle
and brake. They are real, ingested values, but they live only inside the replay
blob — `replay_data.data`, a gzipped MessagePack payload written at ingest —
so no query can reach them.

That blob is ~14 MB compressed and ~72 MB decoded. Unpacking it whole costs
0.75 s and **631 MB of resident memory**, which no web process can afford per
request, so the frames are streamed and discarded one at a time: 0.25 s and
24 MB for the same answer.
"""

import gzip
import io
import struct
from typing import Any, BinaryIO

import msgpack

TELEMETRY_FORMAT_VERSION = 1

# Samples per second in the artifact. A lap lands around 400 samples, which is
# more than a strip chart can draw, and the whole race packs to roughly 34 KB.
TARGET_FPS = 5

# Frame slot indices in the replay payload's per-driver array.
SLOT_SPEED = 2
SLOT_GEAR = 3
SLOT_LAP = 7
SLOT_THROTTLE = 9
SLOT_BRAKE = 10

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


class _DriverTrace:
    """One driver's channels, collected as the frames stream past."""

    def __init__(self) -> None:
        self.speed: list[int] = []
        self.gear: list[int] = []
        self.throttle: list[int] = []
        self.brake: list[int] = []
        self.lap: list[int] = []
        # A car that stops is absent from every later frame. Holding its last
        # values would draw it still driving, so the trace is cut here instead.
        self.last_present = -1

    def append(self, entry: list[Any] | None) -> None:
        if entry is not None:
            self.speed.append(round(float(entry[SLOT_SPEED])))
            self.gear.append(round(float(entry[SLOT_GEAR])))
            self.throttle.append(round(float(entry[SLOT_THROTTLE])))
            self.brake.append(round(float(entry[SLOT_BRAKE])))
            self.lap.append(round(float(entry[SLOT_LAP])))
            self.last_present = len(self.speed) - 1
            return
        # Hold the previous reading so the sample index stays on the clock.
        for channel in (self.speed, self.gear, self.throttle, self.brake, self.lap):
            channel.append(channel[-1] if channel else 0)

    def truncate(self) -> None:
        end = self.last_present + 1
        self.speed = self.speed[:end]
        self.gear = self.gear[:end]
        self.throttle = self.throttle[:end]
        self.brake = self.brake[:end]
        self.lap = self.lap[:end]


def _lap_starts(laps: list[int]) -> list[int]:
    """The sample index each lap begins at, indexed from lap one."""
    seen: dict[int, int] = {}
    for index, lap in enumerate(laps):
        seen.setdefault(lap, index)
    highest = max(laps) if laps else 0
    return [seen.get(number, -1) for number in range(1, highest + 1)]


def _stream(source: BinaryIO, driver_code: str) -> tuple[_DriverTrace, float] | None:
    """Walk the payload without ever holding more than one frame."""
    unpacker = msgpack.Unpacker(source, raw=False, max_buffer_size=0)
    trace = _DriverTrace()
    source_fps: float | None = None
    step = 1
    seen_frames = False

    for _ in range(unpacker.read_map_header()):
        key = unpacker.unpack()
        if key == "metadata":
            metadata = unpacker.unpack()
            source_fps = float(metadata.get("fps") or 0) or None
            if source_fps:
                step = max(1, round(source_fps / TARGET_FPS))
        elif key == "frames":
            if source_fps is None:
                # `metadata` precedes `frames` in every payload the ingest
                # writes; without it there is no sample rate to report.
                return None
            seen_frames = True
            for index in range(unpacker.read_array_header()):
                frame = unpacker.unpack()
                if index % step:
                    continue
                trace.append(frame["d"].get(driver_code))
        else:
            unpacker.skip()

    if not seen_frames or source_fps is None:
        return None
    return trace, source_fps / step


def build_driver_telemetry(blob: bytes, driver_code: str) -> bytes | None:
    """
    Slice one driver's channels out of a replay blob.

    Returns the gzip-compressed MessagePack artifact, or None when the payload
    is unreadable or the driver never appears in it.
    """
    with gzip.GzipFile(fileobj=io.BytesIO(blob)) as source:
        streamed = _stream(source, driver_code)

    if streamed is None:
        return None
    trace, fps = streamed
    if trace.last_present < 0:
        return None
    trace.truncate()

    return gzip.compress(
        msgpack.packb(
            {
                "v": TELEMETRY_FORMAT_VERSION,
                "code": driver_code,
                "fps": fps,
                "samples": len(trace.speed),
                "speed": _pack_i16_deltas(trace.speed),
                "gear": _pack_u8(trace.gear),
                "throttle": _pack_u8(trace.throttle),
                "brake": _pack_u8(trace.brake),
                "lap_starts": _lap_starts(trace.lap),
            },
            use_bin_type=True,
        ),
        compresslevel=9,
    )
