"""The editorial queue: generate proposals, read one in full, then schedule it.

Generating and freezing run the authoring path, which is synchronous
SQLAlchemy against its own session. Both are offloaded to a thread rather than
rewritten async: they are admin-only, they run for seconds rather than
milliseconds, and a second implementation of either is a second thing that can
disagree with the evidence a player is shown.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AggDriverCareer, Puzzle
from app.schemas.admin_puzzle import (
    AdminPuzzleDetail,
    AdminPuzzleListResponse,
    AdminPuzzleSummary,
    PuzzleAnswer,
    PuzzleCell,
    PuzzleFinding,
    PuzzleGenerateRequest,
    PuzzleGenerateResponse,
    PuzzleScheduleRequest,
    PuzzleStatusResponse,
)
from app.schemas.daily_grid import GameCategory


def _findings(puzzle: Puzzle) -> list[PuzzleFinding]:
    report = puzzle.validator_report or {}
    return [PuzzleFinding(**finding) for finding in report.get("findings", [])]


def _depths(puzzle: Puzzle) -> tuple[int, int]:
    answers = puzzle.answers or {}
    if not answers:
        return 0, 0
    sizes = [len(value) for value in answers.values()]
    return min(sizes), max(sizes)


def _summary(puzzle: Puzzle) -> AdminPuzzleSummary:
    findings = _findings(puzzle)
    minimum, maximum = _depths(puzzle)
    return AdminPuzzleSummary(
        number=puzzle.number,
        public_id=puzzle.public_id,
        status=puzzle.status,
        published_on=puzzle.published_on,
        eligibility_floor=puzzle.eligibility_floor,
        difficulty_score=puzzle.difficulty_score,
        min_depth=minimum,
        max_depth=maximum,
        error_count=sum(1 for f in findings if f.level == "error"),
        warning_count=sum(1 for f in findings if f.level == "warning"),
        created_at=puzzle.created_at,
    )


class AdminPuzzleService:
    """Nothing here resolves predicates. The board was materialized when it was
    proposed and is read back as frozen, so the reviewer judges the board that
    will be played rather than one re-derived under today's data."""

    @staticmethod
    async def list_puzzles(
        db: AsyncSession, status: str | None = None
    ) -> AdminPuzzleListResponse:
        statement = select(Puzzle).order_by(
            Puzzle.published_on.is_(None).desc(),
            Puzzle.published_on,
            Puzzle.number,
        )
        if status:
            statement = statement.where(Puzzle.status == status)
        puzzles = (await db.execute(statement)).scalars().all()
        return AdminPuzzleListResponse(puzzles=[_summary(puzzle) for puzzle in puzzles])

    @staticmethod
    async def generate(
        db: AsyncSession, request: PuzzleGenerateRequest
    ) -> PuzzleGenerateResponse:
        """Propose boards as drafts.

        Every proposal is validated before it is stored and dropped if it
        fails, so what lands here is legal but unreviewed. Fewer boards than
        requested is a normal outcome: the generator drops what it cannot make
        pass rather than lowering the bar.
        """
        # Imported here because the authoring path pulls in the whole predicate
        # layer, which the API has no reason to load at import time.
        from scripts.game_generator import generate_and_store

        start = request.start_on or date.today() + timedelta(days=1)
        numbers = await run_in_threadpool(
            generate_and_store,
            request.count,
            start,
            request.eligibility_floor,
            request.seed,
            set(request.theme) or None,
        )
        if not numbers:
            return PuzzleGenerateResponse(requested=request.count, created=[])

        # The generator committed on its own connection, so this session has to
        # read the rows back rather than expect them in its identity map.
        created = (
            await db.execute(
                select(Puzzle).where(Puzzle.number.in_(numbers)).order_by(Puzzle.number)
            )
        ).scalars()
        return PuzzleGenerateResponse(
            requested=request.count,
            created=[_summary(puzzle) for puzzle in created],
        )

    @staticmethod
    async def _puzzle(db: AsyncSession, number: int) -> Puzzle:
        puzzle = (
            await db.execute(select(Puzzle).where(Puzzle.number == number))
        ).scalar_one_or_none()
        if puzzle is None:
            raise ValueError("Grid not found")
        return puzzle

    @staticmethod
    async def detail(db: AsyncSession, number: int) -> AdminPuzzleDetail:
        puzzle = await AdminPuzzleService._puzzle(db, number)
        answers = puzzle.answers or {}

        slugs = {slug for cell in answers.values() for slug in cell}
        careers = {
            row.driver_slug: row
            for row in (
                await db.execute(
                    select(AggDriverCareer).where(
                        AggDriverCareer.driver_slug.in_(slugs),
                        AggDriverCareer.include_sprint.is_(False),
                    )
                )
            ).scalars()
        }

        rows = [GameCategory(**category) for category in puzzle.row_categories]
        columns = [GameCategory(**category) for category in puzzle.column_categories]
        labels = {
            category["id"]: category["label"]
            for category in puzzle.row_categories + puzzle.column_categories
        }

        cells = []
        for row in puzzle.row_categories:
            for column in puzzle.column_categories:
                cell_id = f"{row['id']}__{column['id']}"
                cell_answers = [
                    PuzzleAnswer(
                        driver_slug=slug,
                        full_name=careers[slug].full_name if slug in careers else slug,
                        wins=careers[slug].total_wins if slug in careers else 0,
                        entries=careers[slug].total_races if slug in careers else 0,
                        podiums=careers[slug].total_podiums if slug in careers else 0,
                        first_season=(
                            careers[slug].first_season if slug in careers else None
                        ),
                        latest_season=(
                            careers[slug].latest_season if slug in careers else None
                        ),
                    )
                    for slug in answers.get(cell_id, [])
                ]
                # Most-raced first: the reviewer is judging whether a player
                # could reach an answer, and that is what recognition tracks.
                cell_answers.sort(
                    key=lambda answer: (-answer.entries, answer.full_name)
                )
                cells.append(
                    PuzzleCell(
                        cell_id=cell_id,
                        row_id=row["id"],
                        column_id=column["id"],
                        row_label=labels[row["id"]],
                        column_label=labels[column["id"]],
                        depth=len(cell_answers),
                        answers=cell_answers,
                    )
                )

        return AdminPuzzleDetail(
            **_summary(puzzle).model_dump(),
            rows=rows,
            columns=columns,
            cells=cells,
            findings=_findings(puzzle),
        )

    @staticmethod
    async def schedule(
        db: AsyncSession,
        number: int,
        request: PuzzleScheduleRequest,
        reviewer_id: int | None,
    ) -> PuzzleStatusResponse:
        """Approve a board onto a date.

        A published board dated in the future is scheduled rather than live,
        so this is the whole publication mechanism: no job runs, the date gate
        in the player service does the rest. A past date backdates the board
        into the archive, which is how a historical board is made.

        Freezing Rookie Mode happens here rather than by hand, so a board
        cannot reach a player in one mode only. Its refusal gate is the last
        check before publication.
        """
        puzzle = await AdminPuzzleService._puzzle(db, number)
        if any(finding.level == "error" for finding in _findings(puzzle)):
            raise ValueError("This board has validator errors and cannot be scheduled")

        clash = (
            await db.execute(
                select(Puzzle.number).where(
                    Puzzle.published_on == request.published_on,
                    Puzzle.status == "published",
                    Puzzle.number != number,
                )
            )
        ).scalar_one_or_none()
        if clash is not None:
            raise ValueError(f"Grid #{clash} is already published on that date")

        if not puzzle.rookie_options:
            await AdminPuzzleService._freeze_rookie(number)
            await db.refresh(puzzle)

        puzzle.published_on = request.published_on
        puzzle.status = request.status
        puzzle.reviewed_at = datetime.now(timezone.utc)
        puzzle.reviewed_by_id = reviewer_id
        await db.commit()
        return PuzzleStatusResponse(
            number=puzzle.number,
            status=puzzle.status,
            published_on=puzzle.published_on,
            reviewed_at=puzzle.reviewed_at,
            reviewed_by_id=puzzle.reviewed_by_id,
        )

    @staticmethod
    async def _freeze_rookie(number: int) -> None:
        """Build and store this board's option lists and evidence.

        Runs on its own synchronous session in a thread, like generation. The
        refusal is surfaced as a scheduling error rather than swallowed: a
        board whose evidence contradicts its answer sets must not publish, and
        that gate has already caught a real bug once.
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

    @staticmethod
    async def revert(db: AsyncSession, number: int) -> PuzzleStatusResponse:
        """Return a board to draft. Refused once its date has passed, because
        a board someone has played is a record rather than a proposal."""
        puzzle = await AdminPuzzleService._puzzle(db, number)
        if (
            puzzle.status == "published"
            and puzzle.published_on is not None
            and puzzle.published_on <= date.today()
        ):
            raise ValueError("This board has already been published")
        puzzle.status = "draft"
        puzzle.reviewed_at = None
        puzzle.reviewed_by_id = None
        await db.commit()
        return PuzzleStatusResponse(
            number=puzzle.number,
            status=puzzle.status,
            published_on=puzzle.published_on,
            reviewed_at=None,
        )

    @staticmethod
    async def delete_draft(db: AsyncSession, number: int) -> None:
        puzzle = await AdminPuzzleService._puzzle(db, number)
        if puzzle.status != "draft":
            raise ValueError("Only a draft board may be deleted")
        await db.delete(puzzle)
        await db.commit()
