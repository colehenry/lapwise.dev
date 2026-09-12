"""Hand-built boards: preview six headers, then store or replace them.

Everything here reads the in-memory catalog, so a preview costs nine set
intersections and the validator. The stored board is materialized from the
same sets the preview showed, so what the reviewer saw is what is frozen.
"""

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Puzzle
from app.models.game import GameSession
from app.schemas.admin_puzzle import (
    AdminPuzzleSummary,
    PuzzleAnswer,
    PuzzleCell,
    PuzzleFinding,
    PuzzleHeadersRequest,
    PuzzlePreviewResponse,
)
from app.services.admin_puzzle_service import summary
from app.services.daily_schedule_service import DailyScheduleService, ScheduledGame
from app.services.grid_catalog_cache import CatalogBundle, catalog_bundle
from scripts.game_validator import Recognition

# Enough names to judge a cell; the stored board keeps every answer.
PREVIEW_ANSWER_LIMIT = 40


def _answer(bundle: CatalogBundle, slug: str) -> PuzzleAnswer:
    facts = bundle.pool[slug]
    years = [race.year for race in facts.races]
    return PuzzleAnswer(
        driver_slug=slug,
        full_name=facts.full_name,
        wins=sum(1 for race in facts.races if race.position == 1),
        entries=len(facts.races),
        podiums=sum(
            1
            for race in facts.races
            if race.position is not None and race.position <= 3
        ),
        first_season=min(years) if years else None,
        latest_season=max(years) if years else None,
    )


def _cell(bundle: CatalogBundle, row_id: str, column_id: str) -> PuzzleCell:
    slugs = bundle.answers(row_id) & bundle.answers(column_id)
    answers = sorted(
        (_answer(bundle, slug) for slug in slugs),
        key=lambda answer: (-answer.entries, answer.full_name),
    )
    return PuzzleCell(
        cell_id=f"{row_id}__{column_id}",
        row_id=row_id,
        column_id=column_id,
        row_label=bundle.header(row_id).label,
        column_label=bundle.header(column_id).label,
        depth=len(slugs),
        answers=answers[:PREVIEW_ANSWER_LIMIT],
    )


def best_solution(
    cells: dict[str, set[str]], recognition: dict[str, Recognition]
) -> dict[str, str] | None:
    """One distinct driver per cell, favouring the best-known names.

    Augmenting paths, like the validator's solver, but candidates are tried
    most-raced first so the matching lands on drivers a player would reach
    for. A final pass upgrades any cell to a better-known unused driver.
    """
    fame = {slug: -entry.entries for slug, entry in recognition.items()}

    def ranked(cell_id: str) -> list[str]:
        return sorted(cells[cell_id], key=lambda slug: (fame.get(slug, 0), slug))

    by_slug: dict[str, str] = {}

    def augment(cell_id: str, seen: set[str]) -> bool:
        for slug in ranked(cell_id):
            if slug in seen:
                continue
            seen.add(slug)
            holder = by_slug.get(slug)
            if holder is None or augment(holder, seen):
                by_slug[slug] = cell_id
                return True
        return False

    for cell_id in sorted(cells, key=lambda key: len(cells[key])):
        if not augment(cell_id, set()):
            return None

    chosen = {cell: slug for slug, cell in by_slug.items()}
    for cell_id, slug in chosen.items():
        for candidate in ranked(cell_id):
            if candidate == slug:
                break
            if candidate not in by_slug:
                del by_slug[slug]
                by_slug[candidate] = cell_id
                chosen[cell_id] = candidate
                break
    return chosen


def _judge(
    bundle: CatalogBundle, request: PuzzleHeadersRequest
) -> tuple[list[PuzzleFinding], int, dict[str, str] | None]:
    """Validator findings, difficulty and a solution for a complete board."""
    from scripts.game_generator import difficulty
    from scripts.game_validator import validate

    rows = [bundle.header(header_id) for header_id in request.rows]
    columns = [bundle.header(header_id) for header_id in request.columns]
    board = {
        "id": "candidate",
        "rows": [header.as_category() for header in rows],
        "columns": [header.as_category() for header in columns],
    }
    by_category = {header.id: bundle.answers(header.id) for header in rows + columns}
    report = validate(None, board, bundle.pool, bundle.recognition, by_category)
    cells = {
        f"{row.id}__{column.id}": by_category[row.id] & by_category[column.id]
        for row in rows
        for column in columns
    }
    findings = [
        PuzzleFinding(level=f.level, code=f.code, message=f.message)
        for f in report.findings
    ]
    return (
        findings,
        difficulty(cells, bundle.recognition, rows + columns),
        best_solution(cells, bundle.recognition),
    )


class AdminBoardBuilderService:
    @staticmethod
    async def preview(request: PuzzleHeadersRequest) -> PuzzlePreviewResponse:
        bundle = await catalog_bundle(request.eligibility_floor)
        chosen = [
            header_id for header_id in request.rows + request.columns if header_id
        ]
        if len(set(chosen)) != len(chosen):
            raise ValueError("A header can only appear once on a board")
        cells = [
            _cell(bundle, row_id, column_id)
            for row_id in request.rows
            for column_id in request.columns
            if row_id and column_id
        ]
        findings: list[PuzzleFinding] = []
        score = None
        solution = None
        if request.complete:
            findings, score, solution = _judge(bundle, request)
        return PuzzlePreviewResponse(
            pool_size=len(bundle.pool),
            cells=cells,
            findings=findings,
            difficulty_score=score,
            solution=(
                {cell_id: _answer(bundle, slug) for cell_id, slug in solution.items()}
                if solution
                else None
            ),
        )

    @staticmethod
    async def _materialize(puzzle: Puzzle, request: PuzzleHeadersRequest) -> None:
        if not request.complete:
            raise ValueError("All six headers are needed to save a board")
        bundle = await catalog_bundle(request.eligibility_floor)
        rows = [bundle.header(header_id) for header_id in request.rows]
        columns = [bundle.header(header_id) for header_id in request.columns]
        if len({header.id for header in rows + columns}) != 6:
            raise ValueError("A header can only appear once on a board")
        findings, score, _ = _judge(bundle, request)
        puzzle.eligibility_floor = request.eligibility_floor
        puzzle.row_categories = [header.as_category() for header in rows]
        puzzle.column_categories = [header.as_category() for header in columns]
        puzzle.answers = {
            f"{row.id}__{column.id}": sorted(
                bundle.answers(row.id) & bundle.answers(column.id)
            )
            for row in rows
            for column in columns
        }
        puzzle.difficulty_score = score
        puzzle.validator_report = {
            "findings": [finding.model_dump() for finding in findings]
        }
        puzzle.rookie_options = None
        puzzle.rookie_evidence = None

    @staticmethod
    async def create(
        db: AsyncSession, request: PuzzleHeadersRequest
    ) -> AdminPuzzleSummary:
        """Store a hand-built board as a draft.

        Numbering continues from the highest board ever stored, so a deleted
        board's number is never reissued.
        """
        next_number = (await db.scalar(select(func.max(Puzzle.number))) or 0) + 1
        puzzle = Puzzle(
            number=next_number,
            public_id=f"grid-{next_number:03d}",
            status="draft",
            row_categories=[],
            column_categories=[],
            answers={},
        )
        await AdminBoardBuilderService._materialize(puzzle, request)
        db.add(puzzle)
        await db.commit()
        await db.refresh(puzzle)
        return summary(puzzle)

    @staticmethod
    async def replace_headers(
        db: AsyncSession, number: int, request: PuzzleHeadersRequest
    ) -> AdminPuzzleSummary:
        """Swap the headers on an unplayed board. Its number and place in the
        schedule are kept; the answers are rebuilt."""
        puzzle = await db.scalar(select(Puzzle).where(Puzzle.number == number))
        if puzzle is None:
            raise ValueError("Grid not found")
        played = await db.scalar(
            select(func.count(GameSession.id)).where(GameSession.puzzle_id == puzzle.id)
        )
        if played:
            raise ValueError(f"Grid #{number} has been played and cannot change")
        await AdminBoardBuilderService._materialize(puzzle, request)
        await db.commit()
        # A dated board is already promised to a day, so its Rookie evidence is
        # rebuilt now rather than left for the next scheduling step.
        if puzzle.published_on is not None:
            await freeze_rookie(number)
        await db.refresh(puzzle)
        return summary(puzzle)


async def freeze_rookie(number: int) -> None:
    """Build and store a board's Rookie option lists and evidence.

    Runs on its own synchronous session in a thread, like generation. A
    refusal is surfaced rather than swallowed: a board whose evidence
    contradicts its answer sets must not publish.
    """
    from scripts.freeze_rookie_options import FreezeRefused, freeze
    from scripts.ingest.utils import get_db_session

    def _run() -> list[str]:
        db = get_db_session()
        try:
            return freeze(db, number)
        finally:
            db.close()

    try:
        await run_in_threadpool(_run)
    except FreezeRefused as refusal:
        raise ValueError(
            f"Rookie Mode could not be frozen for this board: {refusal}"
        ) from refusal


async def prepare_grid(db: AsyncSession, number: int) -> None:
    """The last gate before a board takes a date.

    Rookie Mode is frozen here rather than by hand, so a board cannot reach a
    player in one mode only.
    """
    puzzle = await db.scalar(select(Puzzle).where(Puzzle.number == number))
    report = puzzle.validator_report or {}
    if any(f.get("level") == "error" for f in report.get("findings", [])):
        raise ValueError("This board has validator errors and cannot be scheduled")
    if not puzzle.rookie_options:
        await freeze_rookie(number)


GRID_SCHEDULE = DailyScheduleService(
    ScheduledGame(
        label="Grid", puzzle=Puzzle, session=GameSession, prepare=prepare_grid
    )
)
