"""Resolve a category predicate to the drivers who satisfy it.

`game_evidence` answers `driver → Evidence`. Board authoring needs the
inverse — `predicate → the drivers who satisfy it` — so a proposed
intersection can be materialized and judged before anyone plays it.

The inverse is the same function run across the pool, not eleven new ones. A
separate implementation would be free to drift from the evidence a player is
shown after guessing; this cannot drift, because it *is* that evidence. The
freeze script already carries a gate for exactly that class of disagreement,
and this removes the way it happens.

Usage:
    PYTHONPATH=$PWD python scripts/game_predicates.py --verify
    PYTHONPATH=$PWD python scripts/game_predicates.py --headers
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from sqlalchemy import distinct, select
from sqlalchemy.orm import Session as OrmSession

from app.models import Session, SessionResult
from scripts.game_evidence import (
    DriverFacts,
    build_context,
    build_evidence,
    load_driver_facts,
)
from scripts.ingest.utils import get_db_session

PUZZLE_DIRECTORY = Path(__file__).resolve().parents[1] / "data" / "game_puzzles"
DEFAULT_ELIGIBILITY_FLOOR = 1990

Pool = dict[str, DriverFacts]


def load_pool(db: OrmSession, eligibility_floor: int) -> Pool:
    """Drivers eligible for a board at the given floor, keyed by slug.

    Eligibility governs who may appear on a board, not what is true about
    them. A driver who debuted in 1988 and raced into 1992 is eligible at a
    1990 floor and still debuted in the 1980s, so their facts carry the whole
    career and only the pool is filtered.
    """
    driver_ids = list(
        db.execute(
            select(distinct(SessionResult.driver_id))
            .join(Session, Session.id == SessionResult.session_id)
            .where(
                Session.session_type == "race",
                Session.year >= eligibility_floor,
            )
        ).scalars()
    )
    facts = load_driver_facts(db, driver_ids)
    return {value.slug: value for value in facts.values() if value.slug}


def resolve(predicate: dict, pool: Pool, context: dict) -> set[str]:
    """Every eligible driver satisfying one predicate."""
    resolved = set()
    for slug, facts in pool.items():
        evidence = build_evidence(facts, predicate, context)
        if evidence is not None and evidence["satisfied"]:
            resolved.add(slug)
    return resolved


def resolve_categories(
    db: OrmSession, categories: Sequence[dict], pool: Pool
) -> dict[str, set[str]]:
    """Answer sets for a list of categories, keyed by category id."""
    context = build_context(db, categories)
    return {
        category["id"]: resolve(category["predicate"], pool, context)
        for category in categories
    }


def materialize(
    rows: Sequence[dict], columns: Sequence[dict], by_category: dict[str, set[str]]
) -> dict[str, set[str]]:
    """Every intersection of a proposed board, keyed `row__column`.

    A cell is the intersection of its two headers by definition, which is why
    a decoy can only ever fail one of them.
    """
    return {
        f"{row['id']}__{column['id']}": by_category[row["id"]]
        & by_category[column["id"]]
        for row in rows
        for column in columns
    }


def _load_board(number: int) -> dict:
    path = PUZZLE_DIRECTORY / f"grid-{number:03d}.json"
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _board_numbers() -> list[int]:
    return sorted(
        int(path.stem.rsplit("-", 1)[1])
        for path in PUZZLE_DIRECTORY.glob("grid-*.json")
    )


def _describe(predicate: dict) -> str:
    extra = {key: value for key, value in predicate.items() if key != "kind"}
    return f"{predicate['kind']}({', '.join(f'{k}={v}' for k, v in extra.items())})"


def verify_boards(db: OrmSession, floor: int) -> bool:
    """Reproduce every frozen board from the predicates alone.

    The hand-authored answer sets are the only independent check the inverse
    has. If a resolver disagrees with them, either the resolver is wrong or a
    board was frozen against a different rule, and both must be found before
    a generator is trusted to propose boards unattended.
    """
    pool = load_pool(db, floor)
    print(f"Pool at {floor}+: {len(pool)} drivers")

    ok = True
    for number in _board_numbers():
        board = _load_board(number)
        categories = board["rows"] + board["columns"]
        by_category = resolve_categories(db, categories, pool)
        cells = materialize(board["rows"], board["columns"], by_category)

        mismatches = []
        for cell_id, resolved in cells.items():
            frozen = set(board["answers"][cell_id])
            if resolved != frozen:
                mismatches.append((cell_id, frozen, resolved))

        depths = sorted(len(answers) for answers in cells.values())
        status = "ok" if not mismatches else f"{len(mismatches)} MISMATCH"
        print(f"  {board['id']}: depths {depths[0]}–{depths[-1]}  {status}")
        for cell_id, frozen, resolved in mismatches:
            missing = sorted(frozen - resolved)
            extra = sorted(resolved - frozen)
            print(f"    {cell_id}")
            if missing:
                print(f"      frozen but not resolved: {missing}")
            if extra:
                print(f"      resolved but not frozen: {extra}")
            ok = False

    return ok


def report_headers(db: OrmSession, floor: int) -> None:
    """How deep each header used by the sandbox boards actually is.

    Header supply is the constraint on a daily schedule: six a board against
    a five-to-seven-day no-repeat window needs 42 distinct headers a week.
    """
    pool = load_pool(db, floor)
    categories: dict[str, dict] = {}
    for number in _board_numbers():
        board = _load_board(number)
        for category in board["rows"] + board["columns"]:
            categories.setdefault(category["id"], category)

    by_category = resolve_categories(db, list(categories.values()), pool)
    print(f"Pool at {floor}+: {len(pool)} drivers")
    print(f"{len(categories)} distinct headers across {len(_board_numbers())} boards\n")
    for category_id, resolved in sorted(
        by_category.items(), key=lambda item: -len(item[1])
    ):
        predicate = categories[category_id]["predicate"]
        print(f"  {len(resolved):>4}  {category_id:<34} {_describe(predicate)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Reproduce every frozen board from the predicates",
    )
    parser.add_argument(
        "--headers",
        action="store_true",
        help="Report how many eligible drivers each known header resolves to",
    )
    parser.add_argument(
        "--floor",
        type=int,
        default=DEFAULT_ELIGIBILITY_FLOOR,
        help=f"Eligibility floor (default {DEFAULT_ELIGIBILITY_FLOOR})",
    )
    args = parser.parse_args()
    if not args.verify and not args.headers:
        parser.error("choose --verify or --headers")

    db = get_db_session()
    ok = True
    try:
        if args.headers:
            report_headers(db, args.floor)
        if args.verify:
            ok = verify_boards(db, args.floor)
    finally:
        db.close()

    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
