"""
Driver Nationality Backfill

Fills `drivers.country_code` from the Jolpica CSV dump, joined only through the
`driver_external_ids(source='jolpica')` mapping. Names, driver codes, and car
numbers are never used to match identities.

Source precedence: reviewed override, Jolpica country code, Jolpica demonym,
existing database value. Anything unresolved stays NULL and is reported.

Dry run by default. `--apply` refuses to write while any game-eligible driver
(a race entrant from 2000 onward) is conflicting, unmapped, or unresolved.

Usage:
    PYTHONPATH=$PWD python scripts/backfill_driver_nationalities.py
    PYTHONPATH=$PWD python scripts/backfill_driver_nationalities.py --dump /path/dump.zip
    PYTHONPATH=$PWD python scripts/backfill_driver_nationalities.py --apply
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy import select, text

from app.models import Driver, DriverExternalId
from app.nationality import normalize_country_code, normalize_demonym
from scripts.ingest import get_db_session
from scripts.jolpica_dump import (
    default_dump_path,
    download_dump,
    file_digest,
    read_tables,
)

SOURCE = "jolpica"
GAME_POOL_START_YEAR = 2000
OVERRIDES_PATH = os.path.join(os.path.dirname(__file__), "../data")
OVERRIDES_FILE = "driver_nationality_overrides.json"
ROLLBACK_DIR = os.path.join(os.path.dirname(__file__), "../logs")

# Coverage pools reported alongside the required post-2000 gate.
REPORTED_POOLS = (2000, 1990)


def load_overrides():
    """Read the reviewed exception file as jolpica reference -> entry."""
    path = os.path.abspath(os.path.join(OVERRIDES_PATH, OVERRIDES_FILE))
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        entries = json.load(f)["overrides"]
    return {entry["jolpica_id"]: entry for entry in entries}


def source_codes(dump_path):
    """Map each Jolpica driver reference to a Lapwise code, or None."""
    drivers = read_tables(dump_path, ["driver"])["driver"]
    resolved = {}
    for row in drivers.itertuples():
        raw_code = None if pd.isna(row.country_code) else row.country_code
        raw_demonym = None if pd.isna(row.nationality) else row.nationality
        resolved[row.reference] = (
            normalize_country_code(raw_code) or normalize_demonym(raw_demonym),
            raw_code,
            raw_demonym,
        )
    return resolved


def game_pool(db, start_year):
    """Driver IDs holding at least one race result from `start_year` onward."""
    rows = db.execute(
        text(
            """
            SELECT DISTINCT sr.driver_id
            FROM session_results sr
            JOIN sessions s ON s.id = sr.session_id
            WHERE s.session_type = 'race' AND s.year >= :year
            """
        ),
        {"year": start_year},
    ).all()
    return {row[0] for row in rows}


def classify(db, resolved, overrides):
    """Bucket every driver row by what the backfill would do to it."""
    rows = db.execute(
        select(
            Driver.id,
            Driver.full_name,
            Driver.country_code,
            DriverExternalId.external_id,
        ).outerjoin(
            DriverExternalId,
            (DriverExternalId.driver_id == Driver.id)
            & (DriverExternalId.source == SOURCE),
        )
    ).all()

    buckets = {
        "unchanged": [],
        "fillable": [],
        "conflicting": [],
        "unmapped": [],
        "unresolved": [],
    }
    for driver_id, name, existing, reference in rows:
        existing = (existing or "").strip() or None
        if reference is None:
            buckets["unmapped"].append((driver_id, name, existing, None, None))
            continue

        override = overrides.get(reference)
        if override:
            code = override["country_code"]
        else:
            code = resolved.get(reference, (None, None, None))[0]

        if code is None:
            buckets["unresolved"].append((driver_id, name, existing, reference, None))
        elif existing is None:
            buckets["fillable"].append((driver_id, name, existing, reference, code))
        elif existing == code:
            buckets["unchanged"].append((driver_id, name, existing, reference, code))
        elif override:
            buckets["fillable"].append((driver_id, name, existing, reference, code))
        else:
            buckets["conflicting"].append((driver_id, name, existing, reference, code))
    return buckets


def report(buckets, pool):
    """Print aggregate counts and a deterministic exception list."""
    print("  Classification:")
    for name in ("unchanged", "fillable", "conflicting", "unmapped", "unresolved"):
        entries = buckets[name]
        in_pool = sum(1 for e in entries if e[0] in pool)
        print(f"    {name:<12} {len(entries):>4}  (game-eligible: {in_pool})")

    for name in ("conflicting", "unresolved", "unmapped"):
        entries = sorted(buckets[name], key=lambda e: (e[0] not in pool, e[1]))
        if not entries:
            continue
        print(f"\n  {name.capitalize()} ({len(entries)}):")
        for driver_id, driver_name, existing, reference, code in entries:
            marker = "GAME" if driver_id in pool else "    "
            detail = f"db={existing or '-'} source={code or '-'}"
            print(f"    {marker} #{driver_id:<4} {driver_name:<28} {detail}")


def blocking(buckets, pool):
    """Game-eligible drivers that must be reviewed before `--apply`."""
    return sorted(
        entry
        for name in ("conflicting", "unmapped", "unresolved")
        for entry in buckets[name]
        if entry[0] in pool
    )


def write_rollback(changes):
    """Save the pre-change values to a gitignored, timestamped artifact."""
    os.makedirs(os.path.abspath(ROLLBACK_DIR), exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.abspath(
        os.path.join(ROLLBACK_DIR, f"driver_nationality_rollback_{stamp}.json")
    )
    with open(path, "w") as f:
        json.dump(
            [
                {"driver_id": entry[0], "country_code": entry[2]}
                for entry in sorted(changes)
            ],
            f,
            indent=2,
        )
    return path


def apply_changes(db, changes):
    """Write every accepted row in one transaction, grouped by code."""
    by_code = {}
    for driver_id, _, _, _, code in changes:
        by_code.setdefault(code, []).append(driver_id)

    for code, driver_ids in sorted(by_code.items()):
        db.execute(
            text("UPDATE drivers SET country_code = :code WHERE id = ANY(:ids)"),
            {"code": code, "ids": sorted(driver_ids)},
        )
    db.commit()


def refresh_aggregates():
    """Rebuild the archive career aggregates that copy `country_code`."""
    from app.database import AsyncSessionLocal
    from app.services.archive_aggregate_service import ArchiveAggregateService

    async def run():
        async with AsyncSessionLocal() as db:
            return await ArchiveAggregateService.rebuild(db)

    counts = asyncio.run(run())
    print(
        f"  ✓ Archive aggregates refreshed: {counts['drivers']} driver rows, "
        f"{counts['constructors']} constructor rows"
    )


def coverage(db, start_year):
    """Missing and total driver counts for one race pool."""
    row = db.execute(
        text(
            """
            SELECT COUNT(*) FILTER (
                       WHERE d.country_code IS NULL OR d.country_code = ''
                   ) AS missing,
                   COUNT(*) AS pool
            FROM drivers d
            WHERE EXISTS (
                SELECT 1
                FROM session_results sr
                JOIN sessions s ON s.id = sr.session_id
                WHERE sr.driver_id = d.id
                  AND s.session_type = 'race'
                  AND s.year >= :year
            )
            """
        ),
        {"year": start_year},
    ).one()
    return row.missing, row.pool


def main():
    parser = argparse.ArgumentParser(
        description="Backfill driver nationalities from the Jolpica dump"
    )
    parser.add_argument("--dump", help="Path to an already-downloaded dump zip")
    parser.add_argument(
        "--apply", action="store_true", help="Write the accepted changes"
    )
    args = parser.parse_args()

    print("\n🌍 Driver nationality backfill\n")

    dump_path = args.dump
    if dump_path:
        print(f"  Dump: {dump_path}")
        print(f"  SHA256: {file_digest(dump_path)}")
    else:
        dump_path = default_dump_path()
        meta = download_dump(dump_path)
        print(f"  Dump: {meta['download_url']}")
        print(f"  Uploaded: {meta['uploaded_at']}")
        print(f"  SHA256: {meta['file_hash']}")

    overrides = load_overrides()
    resolved = source_codes(dump_path)
    print(f"\n  {len(resolved)} source drivers, {len(overrides)} reviewed overrides\n")

    db = get_db_session()
    try:
        pool = game_pool(db, GAME_POOL_START_YEAR)
        buckets = classify(db, resolved, overrides)
        report(buckets, pool)

        blocked = blocking(buckets, pool)
        changes = buckets["fillable"]

        if not args.apply:
            print(f"\n  Dry run: {len(changes)} rows would change. Pass --apply.")
            return 1 if blocked else 0

        if blocked:
            print(f"\n  ❌ {len(blocked)} game-eligible drivers need review. Refusing.")
            return 1

        if not changes:
            print("\n  ✓ Nothing to change.")
            return 0

        rollback_path = write_rollback(changes)
        print(f"\n  Rollback artifact: {rollback_path}")
        apply_changes(db, changes)
        print(f"  ✓ Updated {len(changes)} drivers")
    finally:
        db.close()

    refresh_aggregates()

    db = get_db_session()
    try:
        for year in REPORTED_POOLS:
            missing, total = coverage(db, year)
            print(f"  Post-{year} pool: {total - missing}/{total} covered")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
