"""Propose boards for the editorial queue.

The generator's job is variety under constraint, not correctness — every
proposal is handed to `game_validator` and dropped if it fails. What this adds
on top is the scheduling memory: which headers and which intersections have run
recently, and how hard the result is likely to feel.

Nothing here publishes. Proposals come out as drafts for a human to order.

Usage:
    PYTHONPATH=$PWD python scripts/game_generator.py --count 10
    PYTHONPATH=$PWD python scripts/game_generator.py --count 30 --write
    PYTHONPATH=$PWD python scripts/game_generator.py --count 3 --theme monza
"""

import argparse
import random
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from app.models import Puzzle
from scripts.game_catalog import Header, build_catalog
from scripts.game_predicates import DEFAULT_ELIGIBILITY_FLOOR, Pool, load_pool
from scripts.game_validator import Recognition, load_recognition, validate
from scripts.ingest.utils import get_db_session

# Rules doc windows.
HEADER_REPEAT_DAYS = 7
INTERSECTION_REPEAT_DAYS = 30

# Two headers selecting nearly the same drivers make a cell that tests one
# thing. Measured on the sandbox boards: podium-finisher against
# race-entries-100 overlaps 86%.
MAX_HEADER_CORRELATION = 0.7

# A header accepting most of the pool cannot carry a board on its own, but it
# is fine crossed with a narrow one. At most one per board.
BROAD_HEADER_SHARE = 0.6

# Venue headers outnumber every other kind in the catalog, so an unconstrained
# sample drifts towards boards asking "won at ..." four times over.
MAX_HEADERS_PER_KIND = 2

PRIMARY_KINDS = {"constructor", "nationality", "race_decade"}

# Kinds a player has to reason about rather than recall.
COMPLEX_KINDS = {
    "named_teammate",
    "multi_constructor_winner",
    "win_from_grid",
    "defunct_venue",
    "won_at_venue",
}

ATTEMPTS_PER_BOARD = 400


@dataclass
class History:
    """What the schedule has already used, and when."""

    header_last_used: dict[str, date] = field(default_factory=dict)
    intersection_last_used: dict[frozenset, date] = field(default_factory=dict)

    header_window: int = HEADER_REPEAT_DAYS

    def header_blocked(self, header_id: str, on: date) -> bool:
        used = self.header_last_used.get(header_id)
        return used is not None and (on - used).days < self.header_window

    def intersection_blocked(self, left: str, right: str, on: date) -> bool:
        used = self.intersection_last_used.get(frozenset((left, right)))
        return used is not None and (on - used).days < INTERSECTION_REPEAT_DAYS

    def record(self, rows: list[Header], columns: list[Header], on: date) -> None:
        for header in rows + columns:
            self.header_last_used[header.id] = on
        for row in rows:
            for column in columns:
                self.intersection_last_used[frozenset((row.id, column.id))] = on


def load_history(db: OrmSession) -> History:
    """Scheduling memory from the boards already in the queue.

    Draft boards count. Two proposals a day apart repeating a header is the
    same problem as two published boards doing it.
    """
    history = History()
    rows = db.execute(
        select(
            Puzzle.published_on, Puzzle.row_categories, Puzzle.column_categories
        ).where(Puzzle.published_on.is_not(None))
    ).all()
    for published_on, row_categories, column_categories in rows:
        history.record(
            [Header(**_header_fields(c)) for c in row_categories],
            [Header(**_header_fields(c)) for c in column_categories],
            published_on,
        )
    return history


def _header_fields(category: dict) -> dict:
    return {
        "id": category["id"],
        "label": category["label"],
        "prompt_label": category["prompt_label"],
        "description": category["description"],
        "visual": category["visual"],
        "predicate": category["predicate"],
    }


def correlated_pairs(
    catalog: dict[str, tuple[Header, set[str]]], threshold: float
) -> set[frozenset]:
    """Header pairs that select nearly the same drivers.

    Computed once over the catalog. Two such headers on one board produce a
    cell whose answers are almost the whole of either header, which reads as
    a single category asked twice.
    """
    pairs = set()
    items = sorted(catalog.items())
    for index, (left_id, (_, left)) in enumerate(items):
        for right_id, (_, right) in items[index + 1 :]:
            union = left | right
            if union and len(left & right) / len(union) >= threshold:
                pairs.add(frozenset((left_id, right_id)))
    return pairs


def difficulty(
    cells: dict[str, set[str]],
    recognition: dict[str, Recognition],
    headers: list[Header],
) -> int:
    """A 0–100 estimate, higher is harder.

    Three things make a board hard: shallow cells, answers nobody can name,
    and predicates that require reasoning rather than recall. Era rides along
    inside recognition, because older drivers have fewer entries in the pool
    a modern player recognises.
    """
    depths = [len(answers) for answers in cells.values()]
    mean_depth = sum(depths) / len(depths)
    # Ten answers a cell is comfortable; three is not.
    depth_score = max(0.0, min(1.0, (10 - mean_depth) / 8))

    best_known = []
    for answers in cells.values():
        known = [recognition[slug].entries for slug in answers if slug in recognition]
        best_known.append(max(known) if known else 0)
    mean_best = sum(best_known) / len(best_known)
    # A cell whose most familiar answer has 200 entries is gettable.
    fame_score = max(0.0, min(1.0, (200 - mean_best) / 200))

    complex_share = sum(1 for header in headers if header.kind in COMPLEX_KINDS) / len(
        headers
    )

    return round(100 * (0.45 * depth_score + 0.4 * fame_score + 0.15 * complex_share))


def _structure(headers: list[Header]) -> str:
    """Where the constructor headers sit, as a template signature."""
    rows = sum(1 for header in headers[:3] if header.kind == "constructor")
    columns = sum(1 for header in headers[3:] if header.kind == "constructor")
    return f"{rows}x{columns}"


@dataclass
class Proposal:
    rows: list[Header]
    columns: list[Header]
    cells: dict[str, set[str]]
    difficulty: int

    @property
    def headers(self) -> list[Header]:
        return self.rows + self.columns

    def as_board(self, number: int, published_on: date, floor: int) -> dict:
        return {
            "id": f"grid-{number:03d}",
            "number": number,
            "published_on": published_on.isoformat(),
            "answer_version": 1,
            "max_guesses": 12,
            "eligibility_floor": floor,
            "rows": [header.as_category() for header in self.rows],
            "columns": [header.as_category() for header in self.columns],
            "answers": {
                cell_id: sorted(answers) for cell_id, answers in self.cells.items()
            },
        }


def propose(
    db: OrmSession,
    catalog: dict[str, tuple[Header, set[str]]],
    pool: Pool,
    recognition: dict[str, Recognition],
    history: History,
    on: date,
    rng: random.Random,
    correlated: set[frozenset],
    theme: set[str] | None = None,
    avoid_structure: str | None = None,
) -> Proposal | None:
    """One board that satisfies the schedule and passes the validator."""
    broad_cutoff = BROAD_HEADER_SHARE * len(pool)
    available = [
        header_id for header_id in catalog if not history.header_blocked(header_id, on)
    ]
    if len(available) < 6:
        return None

    def compatible(picked: list[str], candidate: str) -> bool:
        """Cheap constraints, checked before any intersection is computed."""
        if candidate in picked:
            return False
        chosen = picked + [candidate]
        kinds = Counter(catalog[header_id][0].kind for header_id in chosen)
        if kinds.most_common(1)[0][1] > MAX_HEADERS_PER_KIND:
            return False
        if any(frozenset((header_id, candidate)) in correlated for header_id in picked):
            return False
        broad = sum(1 for h in chosen if len(catalog[h][1]) > broad_cutoff)
        return broad <= 1

    for _ in range(ATTEMPTS_PER_BOARD):
        row_ids: list[str] = []
        for candidate in rng.sample(available, k=len(available)):
            if len(row_ids) == 3:
                break
            if compatible(row_ids, candidate):
                row_ids.append(candidate)
        if len(row_ids) < 3:
            continue

        # Only headers that already cross every chosen row deeply enough are
        # worth considering as columns. Checking this before sampling is what
        # turns a rejection loop into a search: the depth floor is the
        # constraint that fails most often.
        row_sets = [catalog[header_id][1] for header_id in row_ids]
        candidates = [
            header_id
            for header_id in available
            if header_id not in row_ids
            and min(len(row & catalog[header_id][1]) for row in row_sets) >= 2
            and not any(
                history.intersection_blocked(row_id, header_id, on)
                for row_id in row_ids
            )
        ]
        if theme:
            themed = [header_id for header_id in candidates if header_id in theme]
            if not themed and not (set(row_ids) & theme):
                continue

        column_ids: list[str] = []
        for candidate in rng.sample(candidates, k=len(candidates)):
            if len(column_ids) == 3:
                break
            if compatible(row_ids + column_ids, candidate):
                column_ids.append(candidate)
        if len(column_ids) < 3:
            continue
        if theme and not (set(row_ids + column_ids) & theme):
            continue

        rows = [catalog[header_id][0] for header_id in row_ids]
        columns = [catalog[header_id][0] for header_id in column_ids]
        headers = rows + columns

        if avoid_structure and _structure(headers) == avoid_structure:
            continue
        if not {header.kind for header in headers} - PRIMARY_KINDS:
            continue

        cells = {
            f"{row.id}__{column.id}": catalog[row.id][1] & catalog[column.id][1]
            for row in rows
            for column in columns
        }

        board = {
            "id": "candidate",
            "rows": [header.as_category() for header in rows],
            "columns": [header.as_category() for header in columns],
        }
        if not validate(db, board, pool, recognition).ok:
            continue

        return Proposal(
            rows=rows,
            columns=columns,
            cells=cells,
            difficulty=difficulty(cells, recognition, headers),
        )
    return None


def generate(
    db: OrmSession,
    count: int,
    start: date,
    floor: int,
    seed: int,
    theme: set[str] | None = None,
    min_depth: int = 12,
    header_window: int = HEADER_REPEAT_DAYS,
) -> list[tuple[date, Proposal]]:
    pool = load_pool(db, floor)
    catalog = build_catalog(db, pool, minimum_depth=min_depth)
    recognition = load_recognition(db, pool)
    history = load_history(db)
    history.header_window = header_window
    correlated = correlated_pairs(catalog, MAX_HEADER_CORRELATION)
    rng = random.Random(seed)

    print(f"Pool {len(pool)}, catalog {len(catalog)} headers,")
    print(f"{len(correlated)} correlated header pairs excluded\n")

    proposals = []
    previous_structure = None
    for offset in range(count):
        on = start + timedelta(days=offset)
        proposal = propose(
            db,
            catalog,
            pool,
            recognition,
            history,
            on,
            rng,
            correlated,
            theme=theme,
            avoid_structure=previous_structure,
        )
        if proposal is None:
            print(f"  {on}: no board found in {ATTEMPTS_PER_BOARD} attempts")
            continue
        history.record(proposal.rows, proposal.columns, on)
        previous_structure = _structure(proposal.headers)
        proposals.append((on, proposal))
    return proposals


def _print(on: date, proposal: Proposal) -> None:
    depths = sorted(len(answers) for answers in proposal.cells.values())
    print(f"  {on}  difficulty {proposal.difficulty:>3}  depths {depths}")
    print(f"      rows    {', '.join(h.label for h in proposal.rows)}")
    print(f"      columns {', '.join(h.label for h in proposal.columns)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--floor", type=int, default=DEFAULT_ELIGIBILITY_FLOOR)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument(
        "--start", default=None, help="First date to schedule (default tomorrow)"
    )
    parser.add_argument(
        "--theme",
        default=None,
        help="Comma-separated header ids, at least one of which must appear",
    )
    parser.add_argument(
        "--min-depth",
        type=int,
        default=12,
        help="Smallest header the catalog will offer (default 12)",
    )
    parser.add_argument(
        "--header-window",
        type=int,
        default=HEADER_REPEAT_DAYS,
        help=f"Days before a header may repeat (default {HEADER_REPEAT_DAYS})",
    )
    parser.add_argument(
        "--write", action="store_true", help="Insert proposals as draft puzzles"
    )
    args = parser.parse_args()

    start = (
        date.fromisoformat(args.start)
        if args.start
        else date.today() + timedelta(days=1)
    )
    theme = set(args.theme.split(",")) if args.theme else None

    db = get_db_session()
    try:
        proposals = generate(
            db,
            args.count,
            start,
            args.floor,
            args.seed,
            theme,
            min_depth=args.min_depth,
            header_window=args.header_window,
        )
        for on, proposal in proposals:
            _print(on, proposal)

        if args.write and proposals:
            next_number = (
                db.execute(
                    select(Puzzle.number).order_by(Puzzle.number.desc()).limit(1)
                )
            ).scalar() or 0
            for offset, (on, proposal) in enumerate(proposals, start=1):
                board = proposal.as_board(next_number + offset, on, args.floor)
                db.add(
                    Puzzle(
                        number=board["number"],
                        public_id=board["id"],
                        status="draft",
                        published_on=on,
                        eligibility_floor=args.floor,
                        row_categories=board["rows"],
                        column_categories=board["columns"],
                        answers=board["answers"],
                        difficulty_score=proposal.difficulty,
                    )
                )
            db.commit()
            print(f"\nWrote {len(proposals)} drafts.")
    finally:
        db.close()

    print(f"\n{len(proposals)} of {args.count} requested.")
    if not proposals:
        sys.exit(1)


if __name__ == "__main__":
    main()
