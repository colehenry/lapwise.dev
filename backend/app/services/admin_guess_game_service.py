"""Editorial queue operations for Guess Game puzzles."""

import random
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GuessGamePuzzle, GuessGameSession
from app.schemas.admin_guess_game import (
    AdminGuessPuzzleGenerateRequest,
    AdminGuessPuzzleGenerateResponse,
    AdminGuessPuzzleListResponse,
    AdminGuessPuzzleScheduleRequest,
    AdminGuessPuzzleStatusResponse,
    AdminGuessPuzzleSummary,
)
from app.services.driver_fact_service import FACT_ALGORITHM_VERSION
from app.services.guess_game_generation_service import choose_driver, eligible_drivers


def _summary(puzzle: GuessGamePuzzle) -> AdminGuessPuzzleSummary:
    snapshot = puzzle.answer_snapshot or {}
    constructor = snapshot.get("constructor") or {}
    return AdminGuessPuzzleSummary(
        number=puzzle.number,
        public_id=puzzle.public_id,
        status=puzzle.status,
        published_on=puzzle.published_on,
        max_guesses=puzzle.max_guesses,
        driver_slug=snapshot.get("driver_slug", ""),
        full_name=snapshot.get("full_name", "Unknown driver"),
        driver_code=snapshot.get("driver_code"),
        debut=snapshot.get("debut", 0),
        last_raced=snapshot.get("last_raced", 0),
        country=snapshot.get("country", "Unknown"),
        constructor=constructor.get("name", "Unknown"),
        career_peak=snapshot.get("career_peak_label", "Unknown"),
        created_at=puzzle.created_at,
    )


class AdminGuessGameService:
    @staticmethod
    async def _puzzle(db: AsyncSession, number: int) -> GuessGamePuzzle:
        puzzle = await db.scalar(
            select(GuessGamePuzzle).where(GuessGamePuzzle.number == number)
        )
        if puzzle is None:
            raise ValueError("Guess Game puzzle not found")
        return puzzle

    @staticmethod
    async def _refuse_if_played(
        db: AsyncSession, puzzle: GuessGamePuzzle, action: str
    ) -> None:
        played = int(
            await db.scalar(
                select(func.count())
                .select_from(GuessGameSession)
                .where(GuessGameSession.puzzle_id == puzzle.id)
            )
            or 0
        )
        if played:
            raise ValueError(
                f"Guess Game #{puzzle.number} has {played} recorded session"
                f"{'' if played == 1 else 's'} and cannot be {action}"
            )

    @staticmethod
    async def list_puzzles(db: AsyncSession) -> AdminGuessPuzzleListResponse:
        puzzles = list(
            (
                await db.scalars(
                    select(GuessGamePuzzle).order_by(GuessGamePuzzle.number.desc())
                )
            ).all()
        )
        return AdminGuessPuzzleListResponse(
            puzzles=[_summary(puzzle) for puzzle in puzzles]
        )

    @staticmethod
    async def generate(
        db: AsyncSession, request: AdminGuessPuzzleGenerateRequest
    ) -> AdminGuessPuzzleGenerateResponse:
        eligible, _ = await eligible_drivers(db)
        if not eligible:
            raise ValueError("No eligible drivers have complete game data and media")
        existing = list(
            (
                await db.scalars(
                    select(GuessGamePuzzle).order_by(GuessGamePuzzle.number)
                )
            ).all()
        )
        recent = [
            puzzle.answer_snapshot for puzzle in existing if puzzle.answer_snapshot
        ]
        next_number = max((puzzle.number for puzzle in existing), default=0) + 1
        rng = random.Random(request.seed)
        created: list[GuessGamePuzzle] = []
        for _ in range(request.count):
            candidate = choose_driver(eligible, recent, rng)
            snapshot = candidate.snapshot()
            recent.append(snapshot)
            puzzle = GuessGamePuzzle(
                public_id=f"guess-{next_number:04d}",
                number=next_number,
                status="draft",
                max_guesses=10,
                answer_driver_id=candidate.driver_id,
                answer_snapshot=snapshot,
                fact_algorithm_version=FACT_ALGORITHM_VERSION,
            )
            db.add(puzzle)
            created.append(puzzle)
            next_number += 1
        await db.commit()
        for puzzle in created:
            await db.refresh(puzzle)
        return AdminGuessPuzzleGenerateResponse(
            requested=request.count,
            eligible=len(eligible),
            created=[_summary(puzzle) for puzzle in created],
        )

    @staticmethod
    async def schedule(
        db: AsyncSession,
        number: int,
        request: AdminGuessPuzzleScheduleRequest,
        reviewer_id: int,
    ) -> AdminGuessPuzzleStatusResponse:
        puzzle = await AdminGuessGameService._puzzle(db, number)
        clash = await db.scalar(
            select(GuessGamePuzzle.number).where(
                GuessGamePuzzle.published_on == request.published_on,
                GuessGamePuzzle.status == "published",
                GuessGamePuzzle.number != number,
            )
        )
        if clash is not None:
            raise ValueError(f"Guess Game #{clash} is already published on that date")
        puzzle.status = "published"
        puzzle.published_on = request.published_on
        puzzle.reviewed_at = datetime.now(timezone.utc)
        puzzle.reviewed_by_id = reviewer_id
        await db.commit()
        return AdminGuessPuzzleStatusResponse(
            number=puzzle.number,
            status=puzzle.status,
            published_on=puzzle.published_on,
            reviewed_at=puzzle.reviewed_at,
            reviewed_by_id=puzzle.reviewed_by_id,
        )

    @staticmethod
    async def revert(db: AsyncSession, number: int) -> AdminGuessPuzzleStatusResponse:
        puzzle = await AdminGuessGameService._puzzle(db, number)
        await AdminGuessGameService._refuse_if_played(db, puzzle, "reverted")
        puzzle.status = "draft"
        puzzle.published_on = None
        puzzle.reviewed_at = None
        puzzle.reviewed_by_id = None
        await db.commit()
        return AdminGuessPuzzleStatusResponse(
            number=puzzle.number,
            status=puzzle.status,
            published_on=None,
            reviewed_at=None,
            reviewed_by_id=None,
        )

    @staticmethod
    async def delete(db: AsyncSession, number: int) -> None:
        puzzle = await AdminGuessGameService._puzzle(db, number)
        await AdminGuessGameService._refuse_if_played(db, puzzle, "deleted")
        await db.delete(puzzle)
        await db.commit()

    @staticmethod
    async def delete_drafts(db: AsyncSession) -> int:
        drafts = list(
            (
                await db.scalars(
                    select(GuessGamePuzzle).where(GuessGamePuzzle.status == "draft")
                )
            ).all()
        )
        removed = 0
        for puzzle in drafts:
            if await db.scalar(
                select(GuessGameSession.id).where(
                    GuessGameSession.puzzle_id == puzzle.id
                )
            ):
                continue
            await db.delete(puzzle)
            removed += 1
        await db.commit()
        return removed
