"""
Jolpica History Backfill (1996-2017)

Loads race lap timing and pit stops from the Jolpica CSV database dump.
FastF1 lap data only exists from 2018; these rows fill the two decades before it.

Backfilled laps carry source='jolpica' and only four real fields: driver, lap
number, position, lap time. Every other lap column stays NULL except is_accurate
and deleted, which are set explicitly so the standard
`is_accurate = true AND deleted = false` filter keeps these rows visible.

Pit stops go to `pit_stops`, one row per stop. Jolpica has them from 2011.

Usage:
    PYTHONPATH=$PWD python scripts/backfill_jolpica_history.py
    PYTHONPATH=$PWD python scripts/backfill_jolpica_history.py --years 2000-2005
    PYTHONPATH=$PWD python scripts/backfill_jolpica_history.py --dump /path/dump.zip
    PYTHONPATH=$PWD python scripts/backfill_jolpica_history.py --dry-run
    PYTHONPATH=$PWD python scripts/backfill_jolpica_history.py --force
"""

import argparse
import hashlib
import io
import os
import sys
import zipfile

import pandas as pd
import requests
from sqlalchemy import select

from app.models import Driver, Lap, PitStop, Session
from scripts.ingest import get_db_session, write_failure_log

DUMP_INDEX_URL = "https://api.jolpi.ca/data/dumps/download/"
DUMP_TIER = "delayed"  # free tier: 14 days behind latest; historical data is static
INSERT_CHUNK = 5000
SOURCE = "jolpica"

# Jolpica session.type for a grand prix race
RACE_TYPE = "R"


def parse_years(spec):
    """Parse '1996-2017' or '2004' into an inclusive year range."""
    if "-" in spec:
        start, end = spec.split("-", 1)
        return int(start), int(end)
    year = int(spec)
    return year, year


def download_dump(dest_path):
    """Download the delayed CSV dump and verify its published SHA256."""
    index = requests.get(DUMP_INDEX_URL, timeout=60)
    index.raise_for_status()
    meta = index.json()[f"{DUMP_TIER}_dumps"]["csv"]

    size_mb = meta["file_size"] / 1e6
    print(f"  ⬇️  Downloading dump ({size_mb:.1f} MB, uploaded {meta['uploaded_at']})")
    resp = requests.get(meta["download_url"], timeout=600)
    resp.raise_for_status()

    digest = hashlib.sha256(resp.content).hexdigest()
    if digest != meta["file_hash"]:
        raise RuntimeError(
            f"Dump hash mismatch: expected {meta['file_hash']}, got {digest}"
        )

    with open(dest_path, "wb") as f:
        f.write(resp.content)
    print(f"  ✓ Verified and saved to {dest_path}")
    return dest_path


def read_table(archive, name):
    """Read one CSV table out of the dump archive."""
    with archive.open(f"formula_one_{name}.csv") as f:
        return pd.read_csv(io.BytesIO(f.read()))


def build_frames(dump_path, start_year, end_year):
    """
    Flatten the dump's relational CSVs into one lap frame and one pit stop frame.

    Join chain: lap -> sessionentry -> session -> round -> season for the
    (year, round) key, and sessionentry -> roundentry -> teamdriver -> driver
    for the Jolpica driver reference.
    """
    with zipfile.ZipFile(dump_path) as archive:
        laps = read_table(archive, "lap")
        pit_stops = read_table(archive, "pitstop")
        entries = read_table(archive, "sessionentry")
        sessions = read_table(archive, "session")
        rounds = read_table(archive, "round")
        seasons = read_table(archive, "season")
        round_entries = read_table(archive, "roundentry")
        team_drivers = read_table(archive, "teamdriver")
        drivers = read_table(archive, "driver")

    races = (
        sessions[sessions["type"] == RACE_TYPE][["id", "round_id"]]
        .rename(columns={"id": "j_session_id"})
        .merge(
            rounds[["id", "number", "season_id"]].rename(
                columns={"id": "round_id", "number": "round"}
            ),
            on="round_id",
        )
        .merge(
            seasons[["id", "year"]].rename(columns={"id": "season_id"}), on="season_id"
        )
    )
    races = races[races["year"].between(start_year, end_year)][
        ["j_session_id", "year", "round"]
    ]

    entries = (
        entries[["id", "session_id", "round_entry_id"]]
        .rename(columns={"id": "session_entry_id", "session_id": "j_session_id"})
        .merge(races, on="j_session_id")
        .merge(
            round_entries[["id", "team_driver_id"]].rename(
                columns={"id": "round_entry_id"}
            ),
            on="round_entry_id",
        )
        .merge(
            team_drivers[["id", "driver_id"]].rename(columns={"id": "team_driver_id"}),
            on="team_driver_id",
        )
        .merge(
            drivers[["id", "reference"]].rename(columns={"id": "driver_id"}),
            on="driver_id",
        )
    )
    keys = entries[["session_entry_id", "year", "round", "reference"]]

    lap_frame = laps[["id", "session_entry_id", "number", "position", "time"]].merge(
        keys, on="session_entry_id"
    )
    lap_frame = lap_frame[lap_frame["number"].notna() & lap_frame["time"].notna()]
    lap_frame["lap_time_seconds"] = pd.to_timedelta(
        lap_frame["time"]
    ).dt.total_seconds()
    # Merges widen these to float; the session lookup key must be int.
    lap_frame = lap_frame.astype({"year": int, "round": int, "number": int})

    pit_frame = pit_stops[
        ["session_entry_id", "lap_id", "number", "duration", "local_timestamp"]
    ].merge(keys, on="session_entry_id")
    pit_frame = pit_frame.merge(
        lap_frame[["id", "number"]].rename(
            columns={"id": "lap_id", "number": "lap_number"}
        ),
        on="lap_id",
    )
    pit_frame["duration_seconds"] = pd.to_timedelta(
        pit_frame["duration"]
    ).dt.total_seconds()
    pit_frame = pit_frame.astype({"year": int, "round": int, "number": int})

    return (
        lap_frame.sort_values(["year", "round", "reference", "number"]),
        pit_frame.sort_values(["year", "round", "reference", "number"]),
    )


def resolve_maps(db, start_year, end_year):
    """Build (year, round) -> session_id and jolpica_id -> driver_id lookups."""
    session_rows = db.execute(
        select(Session.id, Session.year, Session.round).where(
            Session.session_type == "race",
            Session.year.between(start_year, end_year),
        )
    ).all()
    driver_rows = db.execute(
        select(Driver.jolpica_id, Driver.id).where(Driver.jolpica_id.isnot(None))
    ).all()
    return (
        {(row.year, row.round): row.id for row in session_rows},
        {row[0]: row[1] for row in driver_rows},
    )


def sessions_with_rows(db, model, session_ids):
    """Return the subset of session_ids that already hold rows in `model`."""
    if not session_ids:
        return set()
    rows = db.execute(
        select(model.session_id)
        .where(model.session_id.in_(list(session_ids)))
        .distinct()
    ).all()
    return {row[0] for row in rows}


def lap_row(session_id, driver_id, record):
    """Map one Jolpica lap record to a `laps` insert."""
    return {
        "session_id": session_id,
        "driver_id": driver_id,
        "lap_number": int(record.number),
        "lap_time_seconds": float(record.lap_time_seconds),
        "position": None if pd.isna(record.position) else int(record.position),
        "is_accurate": True,
        "deleted": False,
        "source": SOURCE,
    }


def pit_row(session_id, driver_id, record):
    """Map one Jolpica pit stop record to a `pit_stops` insert."""
    return {
        "session_id": session_id,
        "driver_id": driver_id,
        "lap_number": int(record.lap_number),
        "stop_number": int(record.number),
        "duration_seconds": None
        if pd.isna(record.duration_seconds)
        else float(record.duration_seconds),
        "local_time": None
        if pd.isna(record.local_timestamp)
        else str(record.local_timestamp),
        "source": SOURCE,
    }


def backfill(db, frame, model, row_builder, label, session_map, driver_map, args):
    """Insert rows race by race, committing per race."""
    existing = sessions_with_rows(db, model, set(session_map.values()))
    inserted_total = 0
    skipped_races = 0
    failures = []

    for (year, round_num), race_rows in frame.groupby(["year", "round"], sort=True):
        event = f"{year} round {round_num}"
        session_id = session_map.get((year, round_num))
        if session_id is None:
            failures.append((round_num, event, "race", "No matching session row"))
            continue

        if session_id in existing:
            if not args.force:
                skipped_races += 1
                continue
            db.query(model).filter(
                model.session_id == session_id, model.source == SOURCE
            ).delete(synchronize_session=False)
            db.commit()

        rows = []
        unmapped = set()
        for record in race_rows.itertuples():
            driver_id = driver_map.get(record.reference)
            if driver_id is None:
                unmapped.add(record.reference)
                continue
            rows.append(row_builder(session_id, driver_id, record))

        if unmapped:
            failures.append(
                (round_num, event, "race", f"Unmapped drivers: {sorted(unmapped)}")
            )

        suffix = " (dry run)" if args.dry_run else ""
        print(f"  {year} R{round_num:02d}: {len(rows)} {label}{suffix}")
        if args.dry_run:
            inserted_total += len(rows)
            continue

        try:
            for start in range(0, len(rows), INSERT_CHUNK):
                db.bulk_insert_mappings(model, rows[start : start + INSERT_CHUNK])
            db.commit()
            inserted_total += len(rows)
        except Exception as exc:
            db.rollback()
            failures.append((round_num, event, "race", exc))
            print(f"  ⚠️  {year} R{round_num} {label} failed: {exc}")

    return inserted_total, skipped_races, failures


def main():
    parser = argparse.ArgumentParser(
        description="Backfill 1996-2017 laps and pit stops from the Jolpica dump"
    )
    parser.add_argument(
        "--years", default="1996-2017", help="Year or range, e.g. 2004 or 2000-2005"
    )
    parser.add_argument("--dump", help="Path to an already-downloaded dump zip")
    parser.add_argument(
        "--dry-run", action="store_true", help="Report row counts without writing"
    )
    parser.add_argument(
        "--force", action="store_true", help="Replace existing jolpica rows"
    )
    args = parser.parse_args()

    start_year, end_year = parse_years(args.years)
    print(f"\n🏁 Jolpica backfill: {start_year}-{end_year}\n")

    dump_path = args.dump
    if not dump_path:
        dump_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../../cache/jolpica_dump.zip")
        )
        os.makedirs(os.path.dirname(dump_path), exist_ok=True)
        download_dump(dump_path)

    lap_frame, pit_frame = build_frames(dump_path, start_year, end_year)
    races = lap_frame.groupby(["year", "round"]).ngroups
    print(
        f"  📊 {len(lap_frame)} laps and {len(pit_frame)} pit stops across {races} races\n"
    )

    db = get_db_session()
    try:
        session_map, driver_map = resolve_maps(db, start_year, end_year)
        laps_in, laps_skipped, failures = backfill(
            db, lap_frame, Lap, lap_row, "laps", session_map, driver_map, args
        )
        print()
        pits_in, pits_skipped, pit_failures = backfill(
            db, pit_frame, PitStop, pit_row, "pit stops", session_map, driver_map, args
        )
    finally:
        db.close()

    failures += pit_failures
    print(f"\n✓ Inserted {laps_in} laps and {pits_in} pit stops")
    if laps_skipped or pits_skipped:
        print(
            f"⏭️  Skipped {laps_skipped} races with laps and {pits_skipped} with pit "
            "stops already present (use --force to replace)"
        )
    if failures:
        write_failure_log(f"jolpica_backfill_{start_year}_{end_year}", failures)
        print(f"⚠️  {len(failures)} races logged with problems")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
