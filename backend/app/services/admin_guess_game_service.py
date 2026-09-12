"""Editorial queue operations for Guess Game puzzles."""

import random

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GuessGamePuzzle, GuessGameSession
from app.schemas.admin_guess_game import (
    AdminGuessPuzzleListResponse,
    AdminGuessPuzzleManualRequest,
    AdminGuessPuzzlePreviewResponse,
    AdminGuessPuzzleRandomizeRequest,
    AdminGuessPuzzleRandomizeResponse,
    AdminGuessPuzzleSummary,
)
from app.schemas.guess_game import (
    GuessGameFact,
    GuessGameGuessResponse,
    GuessGameHighlight,
    GuessGameValues,
)
from app.services.daily_schedule_service import DailyScheduleService, ScheduledGame
from app.services.driver_attribute_service import (
    DriverAttributes,
    DriverAttributeService,
)
from app.services.driver_fact_service import FACT_ALGORITHM_VERSION, DriverFactService
from app.services.game_driver_catalog_service import GameDriverCatalogService
from app.services.guess_game_generation_service import choose_driver, eligible_drivers
from app.services.guess_game_service import GuessGameService

SIMILAR_LIMIT = 10


def summary(puzzle: GuessGamePuzzle) -> AdminGuessPuzzleSummary:
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


GUESS_SCHEDULE = DailyScheduleService(
    ScheduledGame(label="Guess Game", puzzle=GuessGamePuzzle, session=GuessGameSession)
)


class AdminGuessGameService:
    @staticmethod
    async def catalog(db: AsyncSession):
        eligible, _ = await eligible_drivers(db)
        return await GameDriverCatalogService.catalog(
            db, {driver.driver_id for driver in eligible}
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
            puzzles=[summary(puzzle) for puzzle in puzzles]
        )

    @staticmethod
    async def randomize(
        db: AsyncSession, request: AdminGuessPuzzleRandomizeRequest
    ) -> AdminGuessPuzzleRandomizeResponse:
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
        return AdminGuessPuzzleRandomizeResponse(
            requested=request.count,
            eligible=len(eligible),
            created=[summary(puzzle) for puzzle in created],
        )

    @staticmethod
    async def add_manual(
        db: AsyncSession,
        request: AdminGuessPuzzleManualRequest,
        reviewer_id: int,
    ) -> GuessGamePuzzle:
        """Store a chosen driver and append it to the upcoming run."""
        eligible, _ = await eligible_drivers(db)
        candidate = next(
            (
                item
                for item in eligible
                if item.driver_slug == request.driver_slug.strip().lower()
            ),
            None,
        )
        if candidate is None:
            raise ValueError("That driver is not eligible for Guess Game")
        next_number = (
            int(await db.scalar(select(func.max(GuessGamePuzzle.number))) or 0) + 1
        )
        puzzle = GuessGamePuzzle(
            public_id=f"guess-{next_number:04d}",
            number=next_number,
            status="draft",
            max_guesses=10,
            answer_driver_id=candidate.driver_id,
            answer_snapshot=candidate.snapshot(),
            fact_algorithm_version=FACT_ALGORITHM_VERSION,
        )
        db.add(puzzle)
        await db.flush()
        return await GUESS_SCHEDULE.approve(db, next_number, reviewer_id)

    @staticmethod
    async def preview(db: AsyncSession, number: int) -> AdminGuessPuzzlePreviewResponse:
        puzzle = await db.scalar(
            select(GuessGamePuzzle).where(GuessGamePuzzle.number == number)
        )
        if puzzle is None or not puzzle.answer_snapshot:
            raise ValueError("Guess Game puzzle not found")
        answer = puzzle.answer_snapshot
        eligible, _ = await eligible_drivers(db)
        by_id = {item.driver_id: item for item in eligible}
        answer_attributes = by_id.get(puzzle.answer_driver_id)
        if answer_attributes is None:
            answer_attributes = (
                await DriverAttributeService.derive(db, [puzzle.answer_driver_id])
            )[puzzle.answer_driver_id]

        def closeness(candidate: DriverAttributes) -> int:
            states = DriverAttributeService.compare(candidate, answer).values()
            return sum(
                2
                if state["state"] == "exact"
                else 1
                if state["state"] == "close"
                else 0
                for state in states
            )

        similar = sorted(
            (item for item in eligible if item.driver_id != puzzle.answer_driver_id),
            key=lambda item: (-closeness(item), -item.starts, item.driver_slug),
        )[:SIMILAR_LIMIT]

        # Fact categories rotate the way they do in play, so the preview
        # shows the variety a player gets rather than ten first wins.
        recent: list[str] = []
        rows = []
        for index, item in enumerate([answer_attributes, *similar], start=1):
            row = await _as_guess(
                db, item, answer, puzzle.public_id, index, recent[-3:]
            )
            recent.append(row.fact.id.split(".", 1)[0])
            rows.append(row)
        return AdminGuessPuzzlePreviewResponse(
            puzzle=summary(puzzle), answer=rows[0], similar=rows[1:]
        )


async def _as_guess(
    db: AsyncSession,
    guessed: DriverAttributes,
    answer: dict,
    puzzle_public_id: str,
    sequence: int,
    recent_categories: list[str],
) -> GuessGameGuessResponse:
    """The row the game would show for this driver against this answer."""
    correct = guessed.driver_slug == answer["driver_slug"]
    fact = DriverFactService.select_fact(
        await DriverFactService.candidates(db, guessed),
        puzzle_public_id,
        guessed.driver_id,
        recent_categories,
    )
    highlights = (
        [
            GuessGameHighlight(id=item.id, value=item.value, label=item.label)
            for item in (await DriverFactService.highlights(db, guessed))[:5]
            if item.value and item.label
        ]
        if correct
        else None
    )
    values = guessed.snapshot()
    return GuessGameGuessResponse(
        sequence=sequence,
        correct=correct,
        driver=await GuessGameService._driver_response(db, guessed.driver_id),
        values=GuessGameValues(
            debut=values["debut"],
            last_raced=values["last_raced"],
            country=values["country"],
            constructor=values["constructor"]["name"],
            career_peak=values["career_peak_label"],
        ),
        comparisons=DriverAttributeService.compare(guessed, answer),
        fact=GuessGameFact(
            id=fact.id,
            text=fact.text,
            constructor_color=guessed.signature_constructor.color,
        ),
        answer=None,
        highlights=highlights,
    )
