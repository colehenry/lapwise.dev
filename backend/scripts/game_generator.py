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
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from app.models import Puzzle
from scripts.game_catalog import MIN_HEADER_DEPTH, Header, build_catalog
from scripts.game_predicates import DEFAULT_ELIGIBILITY_FLOOR, Pool, load_pool
from scripts.game_validator import Recognition, load_recognition, validate
from scripts.ingest.utils import get_db_session

# Rules doc windows.
HEADER_REPEAT_DAYS = 7
INTERSECTION_REPEAT_DAYS = 30

# Two headers selecting nearly the same drivers make a cell that tests one
# thing. Measured on the sandbox boards: podium-finisher against
# race-entries-100 overlaps 86%.
MAX_HEADER_CORRELATION = 0.5

# A header accepting most of the pool cannot carry a board on its own, but it
# is fine crossed with a narrow one. At most one per board.
BROAD_HEADER_SHARE = 0.6

# Venue headers outnumber every other kind in the catalog, so an unconstrained
# sample drifts towards boards asking "won at ..." four times over. Decade
# headers are capped harder: two eras on one board is one question asked
# twice ("Raced in the 2010s" against "Debuted in the 2010s").
MAX_HEADERS_PER_KIND = 2
KIND_CAPS = {"race_decade": 1, "debut_decade": 1}

# Every board carries a team. Constructors are the category a casual fan
# recognises first, and a board without one reads as trivia.
MIN_CONSTRUCTOR_HEADERS = 1

# Boards past this play as a slog rather than a puzzle. The score is the
# generator's own estimate, so this is a soft ceiling on its output, not a
# rule about hand-built boards.
MAX_DIFFICULTY = 45

# Kinds that read as a special move rather than a category. One of each per
# board at most: two "Won at" or two "Teammate of" headers stop being flavour
# and become the board's whole personality. Venue and teammate headers are
# also the bulk of the catalog by count, so without this cap an unconstrained
# walk fills four of six slots with them.
NICHE_KINDS = {"named_teammate", "defunct_venue", "won_at_venue"}
MAX_NICHE_HEADERS_PER_KIND = 1

# Kinds a player recalls rather than reasons about. A board is anchored by at
# least this many of them so it reads as categories, not trivia.
PRIMARY_KINDS = {"constructor", "nationality", "race_decade"}
MIN_PRIMARY_HEADERS = 3

# Sampling weights. Uniform sampling over the catalog is what produced boards
# built on Ligier and Larrousse: the catalog's only entry requirement is twelve
# eligible drivers, and a team that ran twenty journeymen clears that as easily
# as Ferrari. There are more forgettable teams than great ones, so uniform
# sampling favours them by count. These bias selection without forbidding
# anything, so an obscure header still appears — just not on every board.

# Share of a header's answers who are champions or five-race winners.
MARQUEE_WEIGHT_FLOOR = 0.15
MARQUEE_WEIGHT_RANGE = 2.5

# Recency, measured as the median last season of a header's answers. The
# catalog's median is 2010; a header centred on 1994 is not wrong, it is just
# not what most of a modern audience can reach for.
RECENCY_PIVOT_SEASON = 2005
RECENCY_FULL_SEASON = 2015
RECENCY_WEIGHT_FLOOR = 0.25
RECENCY_WEIGHT_RANGE = 1.75

# Board-level budgets. Appeal weights order the candidates; these decide what a
# finished board is allowed to be. Weighting alone cannot: it is a shuffle, and
# once the per-kind caps and the repeat window block the strong headers the walk
# takes whatever is left. Six individually-legal weak headers assembled into
# "Won at Imola / French driver / British driver" against "Raced in the 1990s /
# Debuted in the 1980s / Raced at a defunct venue".

# A header's centre of gravity is the median last season of its answers. One
# retro header is flavour; three is a board about a decade most of the audience
# never watched. The pivot equals the recency pivot by coincidence of value,
# not of meaning: that one starts a weight rising, this one draws a line.
RETRO_PIVOT_SEASON = 2005
MAX_RETRO_HEADERS = 1

# Mean appeal across the six headers, on the scale `header_profile` returns.
# The catalog median is 1.15, so this rejects a board built mostly from
# below-median headers without demanding six strong ones.
MIN_BOARD_APPEAL = 1.2

# Kinds a player has to reason about rather than recall.
COMPLEX_KINDS = {
    "named_teammate",
    "multi_constructor_winner",
    "win_from_grid",
    "defunct_venue",
    "won_at_venue",
}

# Raising this does not help. Measured over a 30-day run, 400 and 1200
# attempts both yield ~23 boards: the binding constraint is the seven-day
# header window, not the search. Strong headers are scarce, blocking one for a
# week pushes the generator onto the weak tail, and the marquee gate then
# rejects what it builds. Yield recovers by growing the catalog, not by trying
# harder.
ATTEMPTS_PER_BOARD = 400


# The header window, then progressively shorter ones. A batch of undated drafts
# is not a schedule — the reviewer decides how far apart two boards sit — so
# refusing to propose anything because six consecutive slots cannot draw
# thirty-six distinct headers from a catalog of sixty-four leaves the queue
# empty, which is worse than a board whose header last appeared two slots ago.
# The floor is one slot, so nothing repeats back to back.
def _relaxations(window: int) -> list[int]:
    steps = [window]
    while steps[-1] > 1:
        steps.append(max(steps[-1] // 2, 1))
    return steps


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
    """Scheduling memory from the boards that hold a date.

    Only approved and published boards count. A draft has no place in the
    schedule yet, so it cannot repeat a header against anything: the windows
    become the reviewer's constraint at the moment they date a board, not the
    generator's against proposals nobody has read.
    """
    history = History()
    rows = db.execute(
        select(
            Puzzle.published_on, Puzzle.row_categories, Puzzle.column_categories
        ).where(Puzzle.published_on.is_not(None), Puzzle.status != "draft")
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


@dataclass(frozen=True)
class Profile:
    """How a header is sampled, and where in history it sits."""

    appeal: float
    median_season: int | None

    @property
    def is_retro(self) -> bool:
        return (
            self.median_season is not None and self.median_season < RETRO_PIVOT_SEASON
        )


# A named-teammate header is as reachable as the driver it names. Its answers
# are the people who sat beside them, whose fame says nothing about whether
# "Teammate of Latifi" is a question anyone can start on.
TEAMMATE_APPEAL = {
    "champion": 3.0,
    "anchor": 2.4,
    "marquee": 1.8,
    "veteran": 1.0,
    "other": 0.3,
}

# Headers below this are not offered to the generator at all. Appeal weights
# only bias a shuffle; with the catalog's long tail of Onyx, AGS and Forti,
# a bias is not enough to keep the tail off the board.
MIN_HEADER_APPEAL = 0.6


def teammate_profile(
    driver_slug: str, answers: set[str], recognition: dict[str, Recognition]
) -> Profile:
    named = recognition.get(driver_slug)
    median = header_profile(answers, recognition).median_season
    if named is None:
        return Profile(TEAMMATE_APPEAL["other"], median)
    if named.is_champion:
        return Profile(TEAMMATE_APPEAL["champion"], median)
    if named.clears_anchor:
        return Profile(TEAMMATE_APPEAL["anchor"], median)
    if named.is_marquee:
        return Profile(TEAMMATE_APPEAL["marquee"], median)
    if named.entries >= 150:
        return Profile(TEAMMATE_APPEAL["veteran"], median)
    return Profile(TEAMMATE_APPEAL["other"], median)


def profile_for(
    header: Header, answers: set[str], recognition: dict[str, Recognition]
) -> Profile:
    if header.kind == "named_teammate":
        return teammate_profile(header.predicate["driver_slug"], answers, recognition)
    return header_profile(answers, recognition)


def header_profile(answers: set[str], recognition: dict[str, Recognition]) -> Profile:
    """How readily a modern audience can answer this header, as a weight.

    Two independent things make a header reachable: whether its answers contain
    names people know, and whether those names are recent. They are multiplied
    rather than averaged so a header has to clear both — a 1994 header full of
    champions and a 2024 header full of nobodies are each penalised once.

    The median season is returned alongside because the era budget needs it and
    it is already computed here. Deriving it separately would let the weight and
    the budget disagree about where a header sits.
    """
    known = [recognition[slug] for slug in answers if slug in recognition]
    if not known:
        return Profile(MARQUEE_WEIGHT_FLOOR * RECENCY_WEIGHT_FLOOR, None)

    marquee_share = sum(1 for entry in known if entry.is_marquee) / len(known)
    fame = MARQUEE_WEIGHT_FLOOR + MARQUEE_WEIGHT_RANGE * marquee_share

    seasons = sorted(
        entry.latest_season for entry in known if entry.latest_season is not None
    )
    if not seasons:
        return Profile(fame * RECENCY_WEIGHT_FLOOR, None)
    median_season = seasons[len(seasons) // 2]
    span = RECENCY_FULL_SEASON - RECENCY_PIVOT_SEASON
    recent_share = max(0.0, min(1.0, (median_season - RECENCY_PIVOT_SEASON) / span))
    recency = RECENCY_WEIGHT_FLOOR + RECENCY_WEIGHT_RANGE * recent_share

    return Profile(fame * recency, median_season)


def board_appeal(header_ids: Sequence[str], profiles: dict[str, Profile]) -> float:
    """Mean appeal across a finished board."""
    return sum(profiles[header_id].appeal for header_id in header_ids) / len(header_ids)


def weighted_order(
    header_ids: Sequence[str], weights: dict[str, float], rng: random.Random
) -> list[str]:
    """The candidate list shuffled so heavier headers tend to come first.

    A weighted shuffle rather than a weighted pick: the caller walks the list
    taking whatever is compatible, so every header stays reachable and the
    constraints still decide what actually lands. Exponential-of-uniform keyed
    ordering draws each item with probability proportional to its weight.
    """
    return sorted(
        header_ids,
        key=lambda header_id: rng.expovariate(1.0) / max(weights[header_id], 1e-6),
    )


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
    # Frozen at proposal time so the editorial queue reads the findings rather
    # than re-deriving them, and so a reviewer sees what the board was judged
    # on rather than what the rules happen to say today.
    findings: list[dict] = field(default_factory=list)

    @property
    def headers(self) -> list[Header]:
        return self.rows + self.columns

    def as_board(self, number: int, floor: int) -> dict:
        return {
            "id": f"grid-{number:03d}",
            "number": number,
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
    # A themed run is asking for several boards about one thing, so the theme
    # headers are exempt from the repeat window. Without this the window blocks
    # the theme after the first board and every later slot fails: a six-board
    # Monza run returned one board and five silent failures.
    available = [
        header_id
        for header_id in catalog
        if (theme and header_id in theme) or not history.header_blocked(header_id, on)
    ]
    if len(available) < 6:
        return None

    profiles = {
        header_id: profile_for(
            catalog[header_id][0], catalog[header_id][1], recognition
        )
        for header_id in available
    }
    available = [
        header_id
        for header_id in available
        if profiles[header_id].appeal >= MIN_HEADER_APPEAL
    ]
    if len(available) < 6:
        return None
    appeal = {header_id: profiles[header_id].appeal for header_id in available}

    def compatible(picked: list[str], candidate: str) -> bool:
        """Cheap constraints, checked before any intersection is computed."""
        if candidate in picked:
            return False
        chosen = picked + [candidate]
        kinds = Counter(catalog[header_id][0].kind for header_id in chosen)
        for kind, count in kinds.items():
            cap = (
                MAX_NICHE_HEADERS_PER_KIND
                if kind in NICHE_KINDS
                else MAX_HEADERS_PER_KIND
            )
            if count > KIND_CAPS.get(kind, cap):
                return False
        retro = sum(1 for header_id in chosen if profiles[header_id].is_retro)
        if retro > MAX_RETRO_HEADERS:
            return False
        if any(frozenset((header_id, candidate)) in correlated for header_id in picked):
            return False
        broad = sum(1 for h in chosen if len(catalog[h][1]) > broad_cutoff)
        return broad <= 1

    for _ in range(ATTEMPTS_PER_BOARD):
        row_ids: list[str] = []
        for candidate in weighted_order(available, appeal, rng):
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
        for candidate in weighted_order(candidates, appeal, rng):
            if len(column_ids) == 3:
                break
            if compatible(row_ids + column_ids, candidate):
                column_ids.append(candidate)
        if len(column_ids) < 3:
            continue
        if board_appeal(row_ids + column_ids, profiles) < MIN_BOARD_APPEAL:
            continue
        if theme and not (set(row_ids + column_ids) & theme):
            continue

        rows = [catalog[header_id][0] for header_id in row_ids]
        columns = [catalog[header_id][0] for header_id in column_ids]
        headers = rows + columns

        if avoid_structure and _structure(headers) == avoid_structure:
            continue
        kinds = [header.kind for header in headers]
        if sum(1 for kind in kinds if kind in PRIMARY_KINDS) < MIN_PRIMARY_HEADERS:
            continue
        if kinds.count("constructor") < MIN_CONSTRUCTOR_HEADERS:
            continue
        if not set(kinds) - PRIMARY_KINDS:
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
        report = validate(db, board, pool, recognition)
        if not report.ok:
            continue
        score = difficulty(cells, recognition, headers)
        if score > MAX_DIFFICULTY:
            continue

        return Proposal(
            rows=rows,
            columns=columns,
            cells=cells,
            difficulty=score,
            findings=[
                {"level": f.level, "code": f.code, "message": f.message}
                for f in report.findings
            ],
        )
    return None


def generate(
    db: OrmSession,
    count: int,
    floor: int,
    seed: int | None = None,
    theme: set[str] | None = None,
    min_depth: int = MIN_HEADER_DEPTH,
    header_window: int = HEADER_REPEAT_DAYS,
) -> list[Proposal]:
    pool = load_pool(db, floor)
    catalog = build_catalog(db, pool, minimum_depth=min_depth)
    recognition = load_recognition(db, pool)
    history = load_history(db)
    history.header_window = header_window
    correlated = correlated_pairs(catalog, MAX_HEADER_CORRELATION)
    # A fixed seed makes a run reproducible; the default must not, or every
    # generation returns the boards the last one did.
    rng = random.Random(seed)

    print(f"Pool {len(pool)}, catalog {len(catalog)} headers,")
    print(f"{len(correlated)} correlated header pairs excluded\n")

    # Proposals are undated. The repeat windows still need to know how far
    # apart two boards would sit, so the run walks consecutive notional days
    # from today: spacing, not a schedule. A reviewer dates a board when they
    # approve it, and `load_history` reads only boards that already carry one.
    proposals = []
    previous_structure = None
    today = date.today()
    for offset in range(count):
        on = today + timedelta(days=offset)
        proposal = None
        for window in _relaxations(header_window):
            history.header_window = window
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
            if proposal is not None:
                if window != header_window:
                    print(f"  slot {offset + 1}: found at a {window}-day header window")
                break
        history.header_window = header_window
        if proposal is None:
            print(
                f"  slot {offset + 1}: no board found in {ATTEMPTS_PER_BOARD} attempts"
            )
            continue
        history.record(proposal.rows, proposal.columns, on)
        previous_structure = _structure(proposal.headers)
        proposals.append(proposal)
    return proposals


def store(db: OrmSession, proposals: list[Proposal], floor: int) -> list[int]:
    """Write proposals as undated drafts and return the numbers created.

    Numbering continues from the highest board ever stored rather than from a
    count, so a retired board's number is never reissued to a different grid.

    A draft carries no date. Dating a board is the act of approving it, and the
    date gate in the player service is the whole publication mechanism, so a
    generator that dated its own output was scheduling boards nobody had read.
    """
    next_number = (
        db.execute(select(Puzzle.number).order_by(Puzzle.number.desc()).limit(1))
    ).scalar() or 0
    numbers = []
    for offset, proposal in enumerate(proposals, start=1):
        board = proposal.as_board(next_number + offset, floor)
        db.add(
            Puzzle(
                number=board["number"],
                public_id=board["id"],
                status="draft",
                published_on=None,
                eligibility_floor=floor,
                row_categories=board["rows"],
                column_categories=board["columns"],
                answers=board["answers"],
                difficulty_score=proposal.difficulty,
                validator_report={"findings": proposal.findings},
            )
        )
        numbers.append(board["number"])
    db.commit()
    return numbers


def generate_and_store(
    count: int,
    floor: int,
    seed: int | None = None,
    theme: set[str] | None = None,
    min_depth: int = MIN_HEADER_DEPTH,
    header_window: int = HEADER_REPEAT_DAYS,
) -> list[int]:
    """Generate and persist in one synchronous unit.

    The admin endpoint calls this in a thread: the authoring path is sync
    SQLAlchemy throughout, and loading the pool and catalog dominates the cost,
    so a batch is barely more expensive than one board.
    """
    db = get_db_session()
    try:
        proposals = generate(db, count, floor, seed, theme, min_depth, header_window)
        return store(db, proposals, floor) if proposals else []
    finally:
        db.close()


def _print(index: int, proposal: Proposal) -> None:
    depths = sorted(len(answers) for answers in proposal.cells.values())
    print(f"  {index:>3}.  difficulty {proposal.difficulty:>3}  depths {depths}")
    print(f"      rows    {', '.join(h.label for h in proposal.rows)}")
    print(f"      columns {', '.join(h.label for h in proposal.columns)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--floor", type=int, default=DEFAULT_ELIGIBILITY_FLOOR)
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Fix the run for reproducibility. Omit for a different board set each time",
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

    theme = set(args.theme.split(",")) if args.theme else None

    db = get_db_session()
    try:
        proposals = generate(
            db,
            args.count,
            args.floor,
            args.seed,
            theme,
            min_depth=args.min_depth,
            header_window=args.header_window,
        )
        for index, proposal in enumerate(proposals, start=1):
            _print(index, proposal)

        if args.write and proposals:
            numbers = store(db, proposals, args.floor)
            print(f"\nWrote {len(numbers)} drafts: #{numbers[0]}–#{numbers[-1]}.")
    finally:
        db.close()

    print(f"\n{len(proposals)} of {args.count} requested.")
    if not proposals:
        sys.exit(1)


if __name__ == "__main__":
    main()
