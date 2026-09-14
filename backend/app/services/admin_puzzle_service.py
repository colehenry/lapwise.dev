"""The editorial queue: generate proposals and read one in full.

Generation runs the authoring path, which is synchronous SQLAlchemy against
its own session. It is offloaded to a thread rather than rewritten async: it is
admin-only, runs for seconds, and a second implementation is a second thing
that can disagree with the evidence a player is shown.

Scheduling lives in `daily_schedule_service`; hand-building in
`admin_board_builder_service`.
"""

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
    PuzzleHeaderCatalogResponse,
    PuzzleHeaderOption,
)
from app.schemas.daily_grid import GameCategory
from app.services.grid_catalog_cache import catalog_bundle


def _findings(puzzle: Puzzle) -> list[PuzzleFinding]:
    report = puzzle.validator_report or {}
    return [PuzzleFinding(**finding) for finding in report.get("findings", [])]


def _depths(puzzle: Puzzle) -> list[int]:
    """Answer counts in board order."""
    answers = puzzle.answers or {}
    return [
        len(answers.get(f"{row['id']}__{column['id']}", []))
        for row in puzzle.row_categories or []
        for column in puzzle.column_categories or []
    ]


def summary(puzzle: Puzzle) -> AdminPuzzleSummary:
    findings = _findings(puzzle)
    depths = _depths(puzzle)
    return AdminPuzzleSummary(
        number=puzzle.number,
        public_id=puzzle.public_id,
        status=puzzle.status,
        published_on=puzzle.published_on,
        eligibility_floor=puzzle.eligibility_floor,
        difficulty_score=puzzle.difficulty_score,
        min_depth=min(depths, default=0),
        max_depth=max(depths, default=0),
        cell_depths=depths,
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
        return AdminPuzzleListResponse(puzzles=[summary(puzzle) for puzzle in puzzles])

    @staticmethod
    async def header_catalog(floor: int) -> PuzzleHeaderCatalogResponse:
        """Every header a board can be built from at one floor, with depth."""
        bundle = await catalog_bundle(floor)
        return PuzzleHeaderCatalogResponse(
            eligibility_floor=floor,
            pool_size=len(bundle.pool),
            headers=sorted(
                (
                    PuzzleHeaderOption(
                        id=header.id,
                        label=header.label,
                        prompt_label=header.prompt_label,
                        kind=header.kind,
                        depth=len(answers),
                        answers=sorted(answers),
                    )
                    for header, answers in bundle.catalog.values()
                ),
                key=lambda option: (option.kind, option.label),
            ),
        )

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

        numbers = await run_in_threadpool(
            generate_and_store,
            request.count,
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
            created=[summary(puzzle) for puzzle in created],
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
            **summary(puzzle).model_dump(),
            rows=rows,
            columns=columns,
            cells=cells,
            findings=_findings(puzzle),
        )
