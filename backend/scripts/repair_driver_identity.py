"""
Reassign results, laps and pit stops that were filed under the wrong driver.

Driver-code collisions attach one driver's results to another's row when the two
share a 3-letter code across eras. `scripts/ingest/participants.py` now refuses a
code match whenever the incoming record carries a jolpica_id, so new ingests
cannot reintroduce this. Rows written before that guard need moving.

Reassignment is by season, because a collision splits a career at the point the
ingestion path changed, not at a race boundary.

Usage:
    PYTHONPATH=$PWD python scripts/repair_driver_identity.py --list-collisions
    PYTHONPATH=$PWD python scripts/repair_driver_identity.py \
        --from-driver 24 --to-driver 799 --years 2018-2024
    PYTHONPATH=$PWD python scripts/repair_driver_identity.py \
        --from-driver 24 --to-driver 799 --years 2018-2024 --apply

Dry-run by default; --apply commits.
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import func, select, update

from app.models import Driver, Lap, PitStop, Session, SessionResult
from scripts.ingest.utils import get_db_session

CHILD_TABLES = (SessionResult, Lap, PitStop)


def parse_years(spec: str) -> list[int]:
    if "-" in spec:
        start, end = spec.split("-", 1)
        return list(range(int(start), int(end) + 1))
    return [int(y) for y in spec.split(",")]


def list_collisions(db) -> int:
    """Report driver rows whose results span implausibly wide or share a code."""
    rows = db.execute(
        select(
            Driver.id,
            Driver.full_name,
            Driver.jolpica_id,
            Driver.driver_code,
            func.min(Session.year),
            func.max(Session.year),
            func.count(SessionResult.id),
        )
        .join(SessionResult, SessionResult.driver_id == Driver.id)
        .join(Session, Session.id == SessionResult.session_id)
        .group_by(Driver.id)
        .having(func.max(Session.year) - func.min(Session.year) > 20)
        .order_by(func.max(Session.year) - func.min(Session.year).desc())
    ).all()

    print("Driver rows spanning more than 20 seasons (career gaps this long are")
    print("almost always two drivers merged into one row):\n")
    for r in rows:
        print(
            f"  id={r[0]:<5} {r[1]:<28} jolpica={r[2] or '-':<20} "
            f"code={r[3] or '-':<4} {r[4]}–{r[5]}  ({r[6]} results)"
        )

    dupes = db.execute(
        select(Driver.driver_code, func.count(Driver.id))
        .where(Driver.driver_code.isnot(None))
        .group_by(Driver.driver_code)
        .having(func.count(Driver.id) > 1)
    ).all()
    if dupes:
        print("\nDriver codes held by more than one row:")
        for code, n in dupes:
            print(f"  {code}: {n} rows")

    return 0


def reassign(db, from_id: int, to_id: int, years: list[int], apply: bool) -> int:
    source = db.get(Driver, from_id)
    target = db.get(Driver, to_id)
    if source is None or target is None:
        print(f"❌ Driver not found (from={from_id}, to={to_id})")
        return 1

    print(f"From: id={source.id} {source.full_name} (jolpica={source.jolpica_id})")
    print(f"To:   id={target.id} {target.full_name} (jolpica={target.jolpica_id})")
    print(f"Seasons: {years[0]}–{years[-1]}\n")

    session_ids = (
        db.execute(select(Session.id).where(Session.year.in_(years))).scalars().all()
    )
    if not session_ids:
        print("No sessions in that range.")
        return 1

    moved = {}
    for model in CHILD_TABLES:
        count = db.execute(
            select(func.count())
            .select_from(model)
            .where(model.driver_id == from_id, model.session_id.in_(session_ids))
        ).scalar()
        moved[model.__tablename__] = count
        print(f"  {model.__tablename__:18} {count:>7} rows")

    if not any(moved.values()):
        print("\nNothing to move.")
        return 0

    if not apply:
        print("\nDry run. Re-run with --apply to commit.")
        return 0

    for model in CHILD_TABLES:
        db.execute(
            update(model)
            .where(model.driver_id == from_id, model.session_id.in_(session_ids))
            .values(driver_id=to_id)
        )
    db.commit()
    print("\n✓ Reassigned.")

    for driver in (source, target):
        span = db.execute(
            select(func.min(Session.year), func.max(Session.year), func.count())
            .select_from(SessionResult)
            .join(Session, Session.id == SessionResult.session_id)
            .where(SessionResult.driver_id == driver.id)
        ).one()
        print(
            f"  id={driver.id} {driver.full_name}: {span[0]}–{span[1]}, {span[2]} results"
        )

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list-collisions", action="store_true")
    parser.add_argument("--from-driver", type=int)
    parser.add_argument("--to-driver", type=int)
    parser.add_argument("--years", help="2018-2024 or 2018,2019,2020")
    parser.add_argument("--set-code", help="Set driver_code on --to-driver")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    db = get_db_session()
    try:
        if args.list_collisions:
            return list_collisions(db)

        if not (args.from_driver and args.to_driver and args.years):
            parser.error("--from-driver, --to-driver and --years are required")

        rc = reassign(
            db, args.from_driver, args.to_driver, parse_years(args.years), args.apply
        )

        if rc == 0 and args.set_code:
            target = db.get(Driver, args.to_driver)
            clash = db.execute(
                select(Driver).where(
                    Driver.driver_code == args.set_code, Driver.id != args.to_driver
                )
            ).scalar_one_or_none()
            if clash:
                print(
                    f"\n⚠ Code {args.set_code} already held by id={clash.id} "
                    f"{clash.full_name}; not set."
                )
            elif args.apply:
                target.driver_code = args.set_code
                db.commit()
                print(f"\n✓ Set driver_code={args.set_code} on id={args.to_driver}")
            else:
                print(f"\nWould set driver_code={args.set_code} on id={args.to_driver}")

        return rc
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
