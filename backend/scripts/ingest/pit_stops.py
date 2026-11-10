"""
Pit stop derivation from FastF1 lap data.

FastF1 splits a stop across two lap rows: PitInTime lands on the in-lap and
PitOutTime on the following out-lap. Neither row holds a stop on its own, so
`laps.pit_duration_seconds` (pit_out - pit_in within one row) is meaningless.
This module pairs the two rows and writes one `pit_stops` row per stop.

Durations are pit lane time (entry to exit), matching what Jolpica reports for
2011-2017, so both eras are comparable.
"""

import math

from sqlalchemy import delete as sql_delete
from sqlalchemy import select

from app.models import DriverSeason, Lap, PitStop, Session, SessionResult

# Non-race sessions are runs in and out of the garage, not pit stops
PIT_STOP_SESSION_TYPES = ("race", "sprint_race")

# Beyond this a car is parked in the garage, not serving a measurable stop.
MAX_STOP_SECONDS = 180


def _is_finite(value):
    """FastF1 writes NaN rather than NULL for laps without pit timing."""
    return value is not None and math.isfinite(value)


def ingest_pit_stops(db, session_id):
    """
    Derive pit stops for a session from its stored lap rows.

    Runs after lap ingestion and replaces any existing fastf1-sourced stops for
    the session, so a re-ingest produces a clean set.

    Returns: number of pit stops written
    """
    session = db.get(Session, session_id)
    if session is None or session.session_type not in PIT_STOP_SESSION_TYPES:
        return 0

    laps = db.execute(
        select(
            Lap.driver_id,
            Lap.lap_number,
            Lap.pit_in_time_seconds,
            Lap.pit_out_time_seconds,
        )
        .where(Lap.session_id == session_id, Lap.source == "fastf1")
        .order_by(Lap.driver_id, Lap.lap_number)
    ).all()

    if not laps:
        print("  ⏭️  No fastf1 laps to derive pit stops from")
        return 0

    db.execute(
        sql_delete(PitStop).where(
            PitStop.session_id == session_id, PitStop.source == "fastf1"
        )
    )

    pending = {}  # driver_id -> (lap_number, pit_in_time)
    stop_counts = {}
    stops = []

    for driver_id, lap_number, pit_in, pit_out in laps:
        if _is_finite(pit_out) and driver_id in pending:
            entry_lap, entry_time = pending.pop(driver_id)
            stop_counts[driver_id] = stop_counts.get(driver_id, 0) + 1
            stops.append(
                {
                    "session_id": session_id,
                    "driver_id": driver_id,
                    "lap_number": entry_lap,
                    "stop_number": stop_counts[driver_id],
                    "duration_seconds": pit_out - entry_time,
                    "local_time": None,
                    "source": "fastf1",
                }
            )
        if _is_finite(pit_in):
            pending[driver_id] = (lap_number, pit_in)

    # A driver who entered the pits and never rejoined still made a stop; the
    # duration is unmeasurable without an out-lap.
    for driver_id, (entry_lap, _) in pending.items():
        stop_counts[driver_id] = stop_counts.get(driver_id, 0) + 1
        stops.append(
            {
                "session_id": session_id,
                "driver_id": driver_id,
                "lap_number": entry_lap,
                "stop_number": stop_counts[driver_id],
                "duration_seconds": None,
                "local_time": None,
                "source": "fastf1",
            }
        )

    if stops:
        db.bulk_insert_mappings(PitStop, stops)
    db.commit()
    print(f"  ✓ Derived {len(stops)} pit stops")
    return len(stops)


def ingest_openf1_pit_stops(db, openf1_session, session_id):
    """Write pit stops from OpenF1's pit lane timings.

    Returns: number of pit stops written
    """
    session = db.get(Session, session_id)
    if session is None or session.session_type not in PIT_STOP_SESSION_TYPES:
        return 0

    rows = openf1_session.pit_stops()
    if not rows:
        print("  ⏭️  OpenF1 has no pit stops for this session")
        return 0

    driver_ids = _driver_ids_by_number(db, session_id, openf1_session.acronyms())

    db.execute(
        sql_delete(PitStop).where(
            PitStop.session_id == session_id, PitStop.source == "openf1"
        )
    )

    stop_counts = {}
    stops = []
    for row in sorted(rows, key=lambda row: row.get("lap_number") or 0):
        driver_id = driver_ids.get(row.get("driver_number"))
        lap_number = row.get("lap_number")
        if driver_id is None or lap_number is None:
            continue
        # Pit lane runs before lights out are not stops in the race.
        if openf1_session.seconds_from_start(row.get("date")) < 0:
            continue

        duration = row.get("pit_duration")
        if not isinstance(duration, (int, float)) or duration > MAX_STOP_SECONDS:
            duration = None

        stop_counts[driver_id] = stop_counts.get(driver_id, 0) + 1
        stops.append(
            {
                "session_id": session_id,
                "driver_id": driver_id,
                "lap_number": int(lap_number),
                "stop_number": stop_counts[driver_id],
                "duration_seconds": duration,
                "local_time": None,
                "source": "openf1",
            }
        )

    if stops:
        db.bulk_insert_mappings(PitStop, stops)
    db.commit()
    print(f"  ✓ Wrote {len(stops)} pit stops")
    return len(stops)


def _driver_ids_by_number(db, session_id, acronyms):
    """Driver ids keyed by car number, resolved through this session's entry list."""
    rows = db.execute(
        select(DriverSeason.driver_code, SessionResult.driver_id)
        .join(Session, Session.year == DriverSeason.year)
        .join(
            SessionResult,
            (SessionResult.session_id == Session.id)
            & (SessionResult.driver_id == DriverSeason.driver_id),
        )
        .where(Session.id == session_id)
    ).all()
    by_code = {row.driver_code: row.driver_id for row in rows}
    return {
        number: by_code[code] for number, code in acronyms.items() if code in by_code
    }
