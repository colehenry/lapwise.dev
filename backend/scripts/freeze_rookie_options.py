"""Freeze Rookie Mode option lists and category evidence into board snapshots.

Option lists derive from the frozen answer sets rather than live queries. A
driver appearing in any cell of a row satisfies that row header, so the
row-only decoy pool for a cell is that row's union minus the column's union.
Every decoy therefore satisfies exactly one of the cell's two headers, which is
forced: satisfying both makes a driver a correct answer for that intersection.

Correct options are pairwise disjoint across the nine cells, so a correct
placement can never consume the only listed answer for another cell under the
one-driver-per-board rule.

Usage:
    PYTHONPATH=$PWD python scripts/freeze_rookie_options.py
    PYTHONPATH=$PWD python scripts/freeze_rookie_options.py --boards 3
    PYTHONPATH=$PWD python scripts/freeze_rookie_options.py --check
"""

import argparse
import json
import random
import sys
from pathlib import Path
from typing import Sequence

from scripts.game_evidence import DriverFacts, build_context, build_evidence
from scripts.game_evidence import load_driver_facts
from scripts.ingest.utils import get_db_session

from sqlalchemy import select

from app.models import Driver

PUZZLE_DIRECTORY = Path(__file__).resolve().parents[1] / "data" / "game_puzzles"
OPTIONS_PER_CELL = 8
MIN_CORRECT_PER_CELL = 1
MAX_CORRECT_PER_CELL = 3


def cell_id(row_id: str, column_id: str) -> str:
    return f"{row_id}__{column_id}"


def _fame(slug: str, facts_by_slug: dict[str, DriverFacts]) -> int:
    facts = facts_by_slug.get(slug)
    return len(facts.races) if facts else 0


def _rank(slugs: Sequence[str], facts_by_slug: dict[str, DriverFacts]) -> list[str]:
    """Most-raced first, so decoys are names a newer fan might recognise."""
    return sorted(slugs, key=lambda slug: (-_fame(slug, facts_by_slug), slug))


def select_correct(
    puzzle: dict, facts_by_slug: dict[str, DriverFacts], rng: random.Random
) -> dict[str, list[str]]:
    """One to three correct options per cell, pairwise disjoint across cells.

    Cells are filled most-constrained first so a shallow intersection is never
    starved by a deep one that had its pick of the same drivers.
    """
    rows = [row["id"] for row in puzzle["rows"]]
    columns = [column["id"] for column in puzzle["columns"]]
    answers = puzzle["answers"]
    order = sorted(
        (cell_id(row, column) for row in rows for column in columns),
        key=lambda key: len(answers[key]),
    )

    taken: set[str] = set()
    chosen: dict[str, list[str]] = {}
    for key in order:
        available = _rank([s for s in answers[key] if s not in taken], facts_by_slug)
        if not available:
            raise SystemExit(f"{puzzle['id']}: no unclaimed answer left for {key}")
        wanted = rng.randint(MIN_CORRECT_PER_CELL, MAX_CORRECT_PER_CELL)
        # Bias toward the recognisable half rather than always taking the most
        # famous, so the correct options are not simply the biggest names.
        pool = available[: max(wanted, len(available) // 2)]
        picked = rng.sample(pool, min(wanted, len(pool)))
        chosen[key] = picked
        taken.update(picked)
    return chosen


def build_options(
    puzzle: dict, facts_by_slug: dict[str, DriverFacts], rng: random.Random
) -> dict[str, list[str]]:
    rows = [row["id"] for row in puzzle["rows"]]
    columns = [column["id"] for column in puzzle["columns"]]
    answers = puzzle["answers"]
    correct = select_correct(puzzle, facts_by_slug, rng)

    row_union = {
        row: set().union(*(answers[cell_id(row, c)] for c in columns)) for row in rows
    }
    column_union = {
        column: set().union(*(answers[cell_id(r, column)] for r in rows))
        for column in columns
    }

    options: dict[str, list[str]] = {}
    for row in rows:
        for column in columns:
            key = cell_id(row, column)
            picked = list(correct[key])
            row_only = _rank(row_union[row] - column_union[column], facts_by_slug)
            column_only = _rank(column_union[column] - row_union[row], facts_by_slug)

            needed = OPTIONS_PER_CELL - len(picked)
            decoys: list[str] = []
            # Alternate sides so neither axis dominates. Where one header
            # implies the other there is nothing on one side at all, and the
            # cell falls back to single-axis decoys.
            sides = [iter(row_only), iter(column_only)]
            while len(decoys) < needed:
                progressed = False
                for side in sides:
                    if len(decoys) >= needed:
                        break
                    for slug in side:
                        if slug in picked or slug in decoys:
                            continue
                        decoys.append(slug)
                        progressed = True
                        break
                if not progressed:
                    break

            cell_options = picked + decoys
            rng.shuffle(cell_options)
            options[key] = cell_options
    return options


def collect_slugs(puzzle: dict, options: dict[str, list[str]]) -> set[str]:
    """Every driver needing frozen evidence: rookie options plus every answer,
    which is what a standard-mode placement can be."""
    slugs = {slug for answers in puzzle["answers"].values() for slug in answers}
    for cell_options in options.values():
        slugs.update(cell_options)
    return slugs


def build_evidence_map(
    db, puzzle: dict, slugs: set[str], facts_by_slug: dict[str, DriverFacts]
) -> dict[str, dict]:
    categories = puzzle["rows"] + puzzle["columns"]
    context = build_context(db, categories)
    evidence: dict[str, dict] = {}
    for category in categories:
        for slug in sorted(slugs):
            facts = facts_by_slug.get(slug)
            if facts is None:
                continue
            payload = build_evidence(facts, category["predicate"], context)
            if payload is not None:
                evidence[f"{slug}__{category['id']}"] = payload
    return evidence


def verify(puzzle: dict, options: dict[str, list[str]], evidence: dict) -> list[str]:
    """Evidence must agree with the frozen answer sets.

    A disagreement means the predicate implementation here and the SQL that
    authored the board disagree about the category, which is a correctness bug
    in one of them and must not reach a player.
    """
    problems: list[str] = []
    rows = {row["id"] for row in puzzle["rows"]}
    columns = {column["id"] for column in puzzle["columns"]}

    for row in rows:
        for column in columns:
            key = cell_id(row, column)
            answers = set(puzzle["answers"][key])
            cell_options = options[key]

            if len(cell_options) != OPTIONS_PER_CELL:
                problems.append(
                    f"{key}: {len(cell_options)} options, expected {OPTIONS_PER_CELL}"
                )
            if len(set(cell_options)) != len(cell_options):
                problems.append(f"{key}: duplicate options")
            if not answers.intersection(cell_options):
                problems.append(f"{key}: no correct option")

            for slug in cell_options:
                row_evidence = evidence.get(f"{slug}__{row}")
                column_evidence = evidence.get(f"{slug}__{column}")
                if row_evidence is None or column_evidence is None:
                    continue
                satisfies_both = (
                    row_evidence["satisfied"] and column_evidence["satisfied"]
                )
                if satisfies_both != (slug in answers):
                    problems.append(
                        f"{key}: {slug} evidence says "
                        f"row={row_evidence['satisfied']} "
                        f"column={column_evidence['satisfied']} "
                        f"but answer set says {slug in answers}"
                    )
                if slug not in answers and not (
                    row_evidence["satisfied"] or column_evidence["satisfied"]
                ):
                    problems.append(f"{key}: {slug} satisfies neither header")

    correct_by_cell = [
        set(puzzle["answers"][key]).intersection(cells)
        for key, cells in options.items()
    ]
    for index, first in enumerate(correct_by_cell):
        for second in correct_by_cell[index + 1 :]:
            overlap = first & second
            if overlap:
                problems.append(f"correct options not disjoint: {sorted(overlap)}")
    return problems


def report_weak_cells(puzzle: dict, options: dict[str, list[str]], evidence: dict):
    """Cells where one header implies the other can only offer single-axis
    decoys. That is a weak cell, and the board author should see it."""
    for row in puzzle["rows"]:
        for column in puzzle["columns"]:
            key = cell_id(row["id"], column["id"])
            answers = set(puzzle["answers"][key])
            axes = set()
            for slug in options[key]:
                if slug in answers:
                    continue
                row_evidence = evidence.get(f"{slug}__{row['id']}")
                if row_evidence is not None:
                    axes.add("row" if row_evidence["satisfied"] else "column")
            if len(axes) == 1:
                print(f"    weak cell {key}: decoys are {axes.pop()}-only")


def freeze(db, number: int, check_only: bool) -> bool:
    path = PUZZLE_DIRECTORY / f"grid-{number:03d}.json"
    puzzle = json.loads(path.read_text(encoding="utf-8"))
    rng = random.Random(puzzle["id"])

    answer_slugs = {slug for answers in puzzle["answers"].values() for slug in answers}
    row_unions = set()
    for row in puzzle["rows"]:
        for column in puzzle["columns"]:
            row_unions.update(puzzle["answers"][cell_id(row["id"], column["id"])])
    driver_ids = {
        slug: driver_id
        for slug, driver_id in db.execute(
            select(Driver.slug, Driver.id).where(Driver.slug.in_(answer_slugs))
        ).all()
    }
    missing = answer_slugs - driver_ids.keys()
    if missing:
        print(f"  {puzzle['id']}: unresolved driver slugs {sorted(missing)}")
        return False

    facts = load_driver_facts(db, list(driver_ids.values()))
    facts_by_slug = {value.slug: value for value in facts.values()}

    options = build_options(puzzle, facts_by_slug, rng)
    slugs = collect_slugs(puzzle, options)
    evidence = build_evidence_map(db, puzzle, slugs, facts_by_slug)
    problems = verify(puzzle, options, evidence)

    print(f"  {puzzle['id']}: {len(options)} cells, {len(evidence)} evidence records")
    report_weak_cells(puzzle, options, evidence)
    if problems:
        for problem in problems[:20]:
            print(f"    FAIL {problem}")
        if len(problems) > 20:
            print(f"    ... {len(problems) - 20} more")
        return False

    if not check_only:
        puzzle["rookie_options"] = options
        puzzle["rookie_evidence"] = evidence
        path.write_text(json.dumps(puzzle, indent=2) + "\n", encoding="utf-8")
        print("    frozen")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--boards",
        default="1-5",
        help="Board number or range, e.g. 3 or 1-5",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate without writing",
    )
    args = parser.parse_args()

    if "-" in args.boards:
        start, end = (int(part) for part in args.boards.split("-", 1))
        numbers = range(start, end + 1)
    else:
        numbers = [int(args.boards)]

    db = get_db_session()
    ok = True
    try:
        for number in numbers:
            ok = freeze(db, number, args.check) and ok
    finally:
        db.close()

    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
