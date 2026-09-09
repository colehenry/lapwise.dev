"""Freeze Rookie Mode option lists and category evidence into board snapshots.

Correct options come from the board's frozen answer sets. Decoys come from its
headers resolved against the whole eligible pool: the row-only pool is every
eligible driver satisfying the row header and failing the column one. Every
decoy therefore satisfies exactly one of the cell's two headers, which is
forced — satisfying both makes a driver a correct answer for that intersection.

Correct options are pairwise disjoint across the nine cells, so a correct
placement can never consume the only listed answer for another cell under the
one-driver-per-board rule.

`build_frozen` is the reusable half: it takes a board in the authoring shape
and returns the option lists, the evidence and any refusal to freeze. The
approval path calls it so a board cannot publish without Rookie Mode, and the
CLI below calls it to re-freeze a board by hand.

Usage:
    PYTHONPATH=$PWD python scripts/freeze_rookie_options.py
    PYTHONPATH=$PWD python scripts/freeze_rookie_options.py --boards 3
    PYTHONPATH=$PWD python scripts/freeze_rookie_options.py --check
"""

import argparse
import random
import sys
from typing import Sequence

from app.models.game import Puzzle
from scripts.game_evidence import DriverFacts, build_context, build_evidence
from scripts.game_predicates import (
    DEFAULT_ELIGIBILITY_FLOOR,
    _board_numbers,
    _load_board,
    load_pool,
    resolve_categories,
)
from scripts.game_validator import solve_assignment
from scripts.ingest.utils import get_db_session

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

    Every cell is seeded from a perfect assignment before any cell takes a
    second option. Filling most-constrained first is not enough on its own: a
    three-answer cell can lose all three to earlier cells that each took a
    spare, and the freeze then fails on a board the validator passed. The
    matching the validator already runs to prove solvability is the same
    matching that guarantees each cell keeps one, so it is reused rather than
    approximated by an ordering heuristic.
    """
    rows = [row["id"] for row in puzzle["rows"]]
    columns = [column["id"] for column in puzzle["columns"]]
    answers = puzzle["answers"]
    cells = {
        cell_id(row, column): set(answers[cell_id(row, column)])
        for row in rows
        for column in columns
    }

    seeded, unmatched = solve_assignment(cells)
    if unmatched:
        raise FreezeRefused(
            [f"{key}: no distinct answer remains for this cell" for key in unmatched]
        )

    chosen = {key: [slug] for key, slug in seeded.items()}
    taken = set(seeded.values())
    for key in sorted(cells, key=lambda k: len(cells[k])):
        wanted = rng.randint(MIN_CORRECT_PER_CELL, MAX_CORRECT_PER_CELL)
        available = _rank([s for s in cells[key] if s not in taken], facts_by_slug)
        # Bias toward the recognisable half rather than always taking the most
        # famous, so the correct options are not simply the biggest names.
        spare = max(0, wanted - 1)
        pool = available[: max(spare, len(available) // 2)]
        picked = rng.sample(pool, min(spare, len(pool)))
        chosen[key].extend(picked)
        taken.update(picked)
    return chosen


def build_options(
    puzzle: dict,
    facts_by_slug: dict[str, DriverFacts],
    by_category: dict[str, set[str]],
    rng: random.Random,
) -> dict[str, list[str]]:
    """Eight options a cell, correct answers plus decoys.

    Decoys are drawn from the headers resolved against the whole eligible
    pool, not from the board's own answer unions. A driver who satisfies the
    row header and fails the column header is a valid decoy whether or not
    they happen to appear in another cell of this board, and restricting to
    the board's own answers made cells that could not be filled at all: on a
    "Won at Montréal" × "Race winner" cell every Montréal winner is already a
    race winner, so the board-relative row-only pool was empty.
    """
    rows = [row["id"] for row in puzzle["rows"]]
    columns = [column["id"] for column in puzzle["columns"]]
    correct = select_correct(puzzle, facts_by_slug, rng)

    options: dict[str, list[str]] = {}
    for row in rows:
        for column in columns:
            key = cell_id(row, column)
            picked = list(correct[key])
            row_only = _rank(by_category[row] - by_category[column], facts_by_slug)
            column_only = _rank(by_category[column] - by_category[row], facts_by_slug)

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


def weak_cells(
    puzzle: dict, options: dict[str, list[str]], evidence: dict
) -> list[str]:
    """Cells where one header implies the other can only offer single-axis
    decoys. That is a weak cell, and the board author should see it."""
    weak = []
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
                weak.append(f"{key}: decoys are {axes.pop()}-only")
    return weak


class FreezeRefused(Exception):
    """The evidence disagrees with the answer sets, so nothing is written.

    This is the last gate before a board reaches a player, and it has already
    paid for itself once: the naive seat-sharing test made Verstappen his own
    teammate and this is what caught it.
    """

    def __init__(self, problems: list[str]):
        self.problems = problems
        super().__init__("; ".join(problems[:5]))


def build_frozen(db, puzzle: dict) -> tuple[dict, dict, list[str]]:
    """Option lists, evidence and weak-cell notes for one board.

    Raises `FreezeRefused` rather than returning a partial freeze, because a
    board whose evidence contradicts its answers must not be publishable.
    """
    rng = random.Random(puzzle["id"])
    floor = puzzle.get("eligibility_floor") or DEFAULT_ELIGIBILITY_FLOOR
    # The board's own pool, not just its answers: decoys are drawn from every
    # eligible driver satisfying one header, so the facts have to span it.
    facts_by_slug = load_pool(db, floor)
    by_category = resolve_categories(
        db, puzzle["rows"] + puzzle["columns"], facts_by_slug
    )

    answer_slugs = {slug for answers in puzzle["answers"].values() for slug in answers}
    missing = answer_slugs - facts_by_slug.keys()
    if missing:
        raise FreezeRefused(
            [f"answers outside the board's {floor} pool: {sorted(missing)}"]
        )

    options = build_options(puzzle, facts_by_slug, by_category, rng)
    slugs = collect_slugs(puzzle, options)
    evidence = build_evidence_map(db, puzzle, slugs, facts_by_slug)
    problems = verify(puzzle, options, evidence)
    if problems:
        raise FreezeRefused(problems)
    return options, evidence, weak_cells(puzzle, options, evidence)


def freeze(db, number: int, check_only: bool = False) -> list[str]:
    """Freeze one board and return its weak-cell notes.

    Raises `FreezeRefused` rather than returning a failure, so a caller that
    forgets to check a boolean cannot publish an unfrozen board.
    """
    puzzle = _load_board(db, number)
    options, evidence, weak = build_frozen(db, puzzle)
    if check_only:
        return weak

    db.execute(
        Puzzle.__table__.update()
        .where(Puzzle.number == number)
        .values(rookie_options=options, rookie_evidence=evidence)
    )
    db.commit()
    return weak


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--boards",
        default=None,
        help="Board number or range, e.g. 3 or 1-5. Defaults to every board",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate without writing",
    )
    args = parser.parse_args()

    db = get_db_session()
    ok = True
    try:
        if args.boards is None:
            numbers: Sequence[int] = _board_numbers(db)
        elif "-" in args.boards:
            start, end = (int(part) for part in args.boards.split("-", 1))
            numbers = range(start, end + 1)
        else:
            numbers = [int(args.boards)]

        for number in numbers:
            try:
                weak = freeze(db, number, args.check)
            except FreezeRefused as refusal:
                print(f"  #{number}: refused")
                for problem in refusal.problems[:20]:
                    print(f"    FAIL {problem}")
                if len(refusal.problems) > 20:
                    print(f"    ... {len(refusal.problems) - 20} more")
                ok = False
                continue
            print(f"  #{number}: {'checked' if args.check else 'frozen'}")
            for note in weak:
                print(f"    weak cell {note}")
    finally:
        db.close()

    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
