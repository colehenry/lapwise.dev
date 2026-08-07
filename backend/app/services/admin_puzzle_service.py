"""The editorial queue: read a proposed board in full, then schedule it."""

from datetime import date, datetime, timezone

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
        in the player service does the rest.
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
