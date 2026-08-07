"""Judge a proposed board against the rules doc before it can be frozen.

Depth counting is the obvious half and the weaker one. The checks that matter
are the ones a count cannot express: that nine *distinct* drivers can fill nine
cells under the one-driver-per-board rule, that a thin cell's answers are names
a player might actually reach for, and that a header does not quietly imply the
one it crosses.

Findings are `error` (the board cannot be frozen) or `warning` (a human should
look). Nothing here publishes anything.

Usage:
    PYTHONPATH=$PWD python scripts/game_validator.py --boards 1-5
    PYTHONPATH=$PWD python scripts/game_validator.py --boards 4 --floor 1990
"""

import argparse
import sys
from dataclasses import dataclass, field
from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from app.models import DriverChampionshipStanding
from scripts.game_predicates import (
    DEFAULT_ELIGIBILITY_FLOOR,
    Pool,
    _board_numbers,
    _load_board,
    load_pool,
    materialize,
    resolve_categories,
)
from scripts.ingest.utils import get_db_session

STANDARD_MIN_ANSWERS = 3
MAX_TWO_ANSWER_CELLS = 2

# A two-answer cell is allowed when neither answer is obscure. All three tests
# are already shipped predicates.
FLOOR_MIN_WINS = 5
FLOOR_MIN_ENTRIES = 100

# At least one answer must be more than merely recognisable, so a player who
# knows only the famous era of an intersection still has a way in.
ANCHOR_MIN_WINS = 10

# Two cells whose answer sets differ by less than this are the same cell twice.
NEAR_IDENTICAL_RATIO = 0.8

# A cell accepting this share of the eligible pool is a free square: almost any
# name a player types lands. Legal, but the reviewer should see it.
FREE_SQUARE_SHARE = 0.2

PRIMARY_KINDS = {"constructor", "nationality", "race_decade"}


@dataclass
class Recognition:
    slug: str
    full_name: str
    wins: int
    entries: int
    is_champion: bool

    @property
    def clears_floor(self) -> bool:
        return (
            self.is_champion
            or self.wins >= FLOOR_MIN_WINS
            or self.entries >= FLOOR_MIN_ENTRIES
        )

    @property
    def clears_anchor(self) -> bool:
        return self.is_champion or self.wins >= ANCHOR_MIN_WINS

    def describe(self) -> str:
        title = "champion, " if self.is_champion else ""
        return f"{self.full_name} ({title}{self.wins} wins, {self.entries} entries)"


@dataclass
class Finding:
    level: str
    code: str
    message: str


@dataclass
class Report:
    board_id: str
    findings: list[Finding] = field(default_factory=list)
    depths: dict[str, int] = field(default_factory=dict)

    def error(self, code: str, message: str) -> None:
        self.findings.append(Finding("error", code, message))

    def warn(self, code: str, message: str) -> None:
        self.findings.append(Finding("warning", code, message))

    @property
    def errors(self) -> list[Finding]:
        return [f for f in self.findings if f.level == "error"]

    @property
    def ok(self) -> bool:
        return not self.errors


def load_recognition(db: OrmSession, pool: Pool) -> dict[str, Recognition]:
    """Wins, entries and titles for the eligible pool.

    Wins and entries come from the same facts the predicates read, so a driver
    cannot clear a gate here on numbers the game would dispute.
    """
    champions = {
        driver_id
        for driver_id in db.execute(
            select(DriverChampionshipStanding.driver_id).where(
                DriverChampionshipStanding.position == 1,
                DriverChampionshipStanding.is_final.is_(True),
            )
        ).scalars()
    }
    return {
        slug: Recognition(
            slug=slug,
            full_name=facts.full_name,
            wins=sum(1 for race in facts.races if race.position == 1),
            entries=len(facts.races),
            is_champion=facts.driver_id in champions,
        )
        for slug, facts in pool.items()
    }


def has_perfect_assignment(cells: dict[str, set[str]]) -> tuple[bool, list[str]]:
    """Whether one distinct driver can fill every cell at once.

    A board where every cell has answers can still be unfinishable, because a
    correctly placed driver is spent for the rest of the board. Nine non-empty
    cells drawing on the same four drivers is the failure a depth count cannot
    see. Augmenting paths over nine cells; the size makes anything cleverer
    pointless.
    """
    assignment: dict[str, str] = {}

    def augment(cell_id: str, seen: set[str]) -> bool:
        for slug in sorted(cells[cell_id]):
            if slug in seen:
                continue
            seen.add(slug)
            holder = assignment.get(slug)
            if holder is None or augment(holder, seen):
                assignment[slug] = cell_id
                return True
        return False

    unmatched = []
    for cell_id in sorted(cells, key=lambda key: len(cells[key])):
        if not augment(cell_id, set()):
            unmatched.append(cell_id)
    return not unmatched, unmatched


def _check_depths(
    report: Report, cells: dict[str, set[str]], recognition: dict[str, Recognition]
) -> None:
    thin = {}
    singletons = []
    for cell_id, answers in cells.items():
        report.depths[cell_id] = len(answers)
        if not answers:
            report.error("empty_cell", f"{cell_id}: no answers")
        elif len(answers) == 1:
            singletons.append(cell_id)
        elif len(answers) < STANDARD_MIN_ANSWERS:
            thin[cell_id] = answers

    for cell_id in singletons:
        slug = next(iter(cells[cell_id]))
        report.warn(
            "singleton",
            f"{cell_id}: single answer {slug} — needs manual signature review",
        )

    if len(thin) > MAX_TWO_ANSWER_CELLS:
        report.error(
            "too_many_thin_cells",
            f"{len(thin)} two-answer cells, at most {MAX_TWO_ANSWER_CELLS} allowed",
        )
    if thin and singletons:
        report.error(
            "thin_cell_with_singleton",
            "a board with a signature singleton may not also carry a two-answer cell",
        )

    for cell_id, answers in thin.items():
        known = [recognition[slug] for slug in sorted(answers) if slug in recognition]
        if len(known) != len(answers):
            continue
        below = [r for r in known if not r.clears_floor]
        if below:
            report.error(
                "thin_cell_below_floor",
                f"{cell_id}: {', '.join(r.describe() for r in below)}"
                " below the recognition floor",
            )
        if not any(r.clears_anchor for r in known):
            report.error(
                "thin_cell_without_anchor",
                f"{cell_id}: no answer clears the anchor gate"
                f" — {', '.join(r.describe() for r in known)}",
            )

    # A driver anchoring two thin cells can only fill one of them, so the board
    # plays tighter than its depths suggest.
    for slug in set.intersection(*thin.values()) if len(thin) > 1 else set():
        report.warn(
            "shared_thin_answer",
            f"{slug} appears in every two-answer cell; spending it narrows the rest",
        )


def _check_structure(report: Report, board: dict, cells: dict[str, set[str]]) -> None:
    categories = board["rows"] + board["columns"]
    kinds = {category["predicate"]["kind"] for category in categories}
    if not kinds - PRIMARY_KINDS:
        report.error(
            "no_secondary_category",
            "every header is constructor, nationality or race decade",
        )

    ids = [category["id"] for category in categories]
    if len(set(ids)) != len(ids):
        report.error("duplicate_header", "a header appears twice on the same board")

    items = sorted(cells.items())
    for index, (left_id, left) in enumerate(items):
        for right_id, right in items[index + 1 :]:
            if not left or not right:
                continue
            overlap = len(left & right) / len(left | right)
            if overlap >= NEAR_IDENTICAL_RATIO:
                report.warn(
                    "near_identical_cells",
                    f"{left_id} and {right_id} share {overlap:.0%} of their answers",
                )


def _check_axis_implication(
    report: Report, board: dict, by_category: dict[str, set[str]]
) -> None:
    """Header pairs where one implies the other, over the whole pool.

    This is the category-level smell: the two headers are not independent, so
    the intersection tests one thing rather than two. It holds regardless of
    which board the pair lands on.
    """
    for row in board["rows"]:
        for column in board["columns"]:
            row_set = by_category[row["id"]]
            column_set = by_category[column["id"]]
            if not row_set or not column_set:
                continue
            if row_set <= column_set:
                report.warn(
                    "header_implies",
                    f"{row['id']} implies {column['id']}: every answer to the"
                    " first satisfies the second, so the pair tests one thing",
                )
            elif column_set <= row_set:
                report.warn(
                    "header_implies",
                    f"{column['id']} implies {row['id']}: every answer to the"
                    " first satisfies the second, so the pair tests one thing",
                )


def _check_decoy_pools(report: Report, board: dict, cells: dict[str, set[str]]) -> None:
    """Whether each cell can actually be given two-sided Rookie decoys.

    Decoys are drawn from the board's own answer unions, not from the whole
    pool, so this is stricter than header implication and is the constraint
    that binds in practice. A cell with an empty pool on one axis can only
    offer decoys that fail the same header every time, which teaches half of
    what the cell is for.
    """
    for row in board["rows"]:
        row_union = set().union(
            *(cells[f"{row['id']}__{column['id']}"] for column in board["columns"])
        )
        for column in board["columns"]:
            column_union = set().union(
                *(cells[f"{other['id']}__{column['id']}"] for other in board["rows"])
            )
            cell_id = f"{row['id']}__{column['id']}"
            if not row_union - column_union:
                report.warn(
                    "single_axis_decoys",
                    f"{cell_id}: no row-only decoys available on this board",
                )
            if not column_union - row_union:
                report.warn(
                    "single_axis_decoys",
                    f"{cell_id}: no column-only decoys available on this board",
                )


def validate(
    db: OrmSession,
    board: dict,
    pool: Pool,
    recognition: dict[str, Recognition],
) -> Report:
    report = Report(board_id=board["id"])
    categories = board["rows"] + board["columns"]
    by_category = resolve_categories(db, categories, pool)
    cells = materialize(board["rows"], board["columns"], by_category)

    unresolved = {
        slug for answers in cells.values() for slug in answers if slug not in pool
    }
    if unresolved:
        report.error("unresolved_driver", f"unknown slugs {sorted(unresolved)}")

    _check_depths(report, cells, recognition)
    for cell_id, answers in sorted(cells.items()):
        if len(answers) > FREE_SQUARE_SHARE * len(pool):
            report.warn(
                "free_square",
                f"{cell_id}: {len(answers)} answers, {len(answers) / len(pool):.0%}"
                " of the eligible pool",
            )
    _check_structure(report, board, cells)
    _check_axis_implication(report, board, by_category)
    _check_decoy_pools(report, board, cells)

    complete, unmatched = has_perfect_assignment(cells)
    if not complete:
        report.error(
            "unsolvable",
            f"no distinct driver remains for {unmatched}"
            " — the board cannot be completed under one-driver-per-board",
        )

    return report


def _parse_boards(spec: str) -> Iterable[int]:
    if "-" in spec:
        start, end = (int(part) for part in spec.split("-", 1))
        return range(start, end + 1)
    return [int(spec)]


def _print(report: Report) -> None:
    depths = sorted(report.depths.values())
    status = "ok" if report.ok else f"{len(report.errors)} ERROR"
    print(f"  {report.board_id}: depths {depths}  {status}")
    for finding in report.findings:
        mark = "FAIL" if finding.level == "error" else "warn"
        print(f"    {mark} [{finding.code}] {finding.message}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--boards", default=None, help="Board number or range")
    parser.add_argument("--floor", type=int, default=DEFAULT_ELIGIBILITY_FLOOR)
    args = parser.parse_args()

    numbers: Sequence[int] = (
        list(_parse_boards(args.boards)) if args.boards else _board_numbers()
    )

    db = get_db_session()
    try:
        pool = load_pool(db, args.floor)
        recognition = load_recognition(db, pool)
        print(f"Pool at {args.floor}+: {len(pool)} drivers\n")
        reports = [validate(db, _load_board(n), pool, recognition) for n in numbers]
    finally:
        db.close()

    for report in reports:
        _print(report)

    failed = [report.board_id for report in reports if not report.ok]
    print()
    if failed:
        print(f"{len(failed)} board(s) cannot be frozen: {', '.join(failed)}")
        sys.exit(1)
    print(f"{len(reports)} board(s) pass.")


if __name__ == "__main__":
    main()
