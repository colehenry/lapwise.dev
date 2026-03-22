"""
Repair driver identity collisions caused by shared 3-letter driver codes.

This script reingests seasons where a collided code appears so session results are
rebuilt using jolpica_id-aware matching (with collision guard).

Usage:
    PYTHONPATH=$PWD python scripts/repair_driver_code_collisions.py --code MSC
    PYTHONPATH=$PWD python scripts/repair_driver_code_collisions.py --code MSC --apply

Notes:
- Dry-run by default (prints affected seasons only).
- With --apply, this will run ingest_season for each affected year and skip highlights.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from sqlalchemy import select, distinct

from scripts.ingest.utils import get_db_session
from app.models import Driver, Session, SessionResult


def get_affected_years(db, code: str) -> list[int]:
    years = (
        db.execute(
            select(distinct(Session.year))
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, Driver.id == SessionResult.driver_id)
            .where(Driver.driver_code == code)
            .order_by(Session.year)
        )
        .scalars()
        .all()
    )
    return list(years)


def get_driver_rows(db, code: str):
    return db.execute(
        select(Driver.id, Driver.full_name, Driver.driver_code, Driver.jolpica_id)
        .where(Driver.driver_code == code)
        .order_by(Driver.id)
    ).all()


def run_reingest(years: list[int], backend_root: Path) -> None:
    for year in years:
        cmd = [
            sys.executable,
            "scripts/ingest_season.py",
            str(year),
            "--skip-highlights",
        ]
        print(f"\n↻ Reingesting season {year}: {' '.join(cmd)}")
        result = subprocess.run(cmd, cwd=backend_root)
        if result.returncode != 0:
            raise RuntimeError(f"Reingestion failed for season {year}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Repair collided driver codes")
    parser.add_argument("--code", required=True, help="3-letter driver code (e.g. MSC)")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply fix by reingesting affected seasons",
    )
    args = parser.parse_args()

    code = args.code.strip().upper()
    if len(code) != 3:
        raise ValueError("--code must be a 3-letter abbreviation")

    db = get_db_session()
    try:
        drivers = get_driver_rows(db, code)
        years = get_affected_years(db, code)

        print(f"Code: {code}")
        print(f"Driver rows with code {code}: {len(drivers)}")
        for row in drivers:
            print(
                f"  - id={row.id} full_name={row.full_name!r} "
                f"driver_code={row.driver_code!r} jolpica_id={row.jolpica_id!r}"
            )

        print(f"Affected seasons: {years}")

        if not args.apply:
            print("\nDry-run only. Re-run with --apply to execute repair.")
            return

        if not years:
            print("\nNo seasons found for this code. Nothing to repair.")
            return

        backend_root = Path(__file__).resolve().parents[1]
        run_reingest(years, backend_root)
        print("\nRepair complete.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
