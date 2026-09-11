"""Puzzle, play, statistics, and leaderboard logic for the guess game."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Driver,
    GuessGameGuess,
    GuessGamePuzzle,
    GuessGameSession,
    User,
)
from app.schemas.daily_games import (
    DailyGameLeaderboardResponse,
    DailyGamePersonalStats,
)
from app.schemas.daily_grid import GameDriver
from app.schemas.guess_game import (
    GuessGameAnswer,
    GuessGameFact,
    GuessGameGuessResponse,
    GuessGameHighlight,
    GuessGamePuzzleResponse,
    GuessGameSessionResponse,
    GuessGameValues,
)
from app.schemas.media import DriverMedia
from app.services.daily_game_clock import puzzle_date
from app.services.daily_game_results_service import (
    assert_session_owner,
    finish_session,
    leaderboard_page,
    summarize_sessions,
)
from app.services.driver_attribute_service import (
    DriverAttributeService,
)
from app.services.driver_fact_service import DriverFactService
from app.services.game_driver_catalog_service import GameDriverCatalogService
from app.services.media_service import MediaService

GLOBAL_DISTRIBUTION_MINIMUM = 10
WINNER_HIGHLIGHT_LIMIT = 5


def _published():
    return (GuessGamePuzzle.status == "published") & (
        GuessGamePuzzle.published_on <= puzzle_date()
    )


def _answer(snapshot: dict) -> GuessGameAnswer:
    return GuessGameAnswer(
        driver_slug=snapshot["driver_slug"],
        full_name=snapshot["full_name"],
        driver_code=snapshot.get("driver_code"),
    )


def _values(snapshot: dict) -> GuessGameValues:
    return GuessGameValues(
        debut=snapshot["debut"],
        last_raced=snapshot["last_raced"],
        country=snapshot["country"],
        constructor=snapshot["constructor"]["name"],
        career_peak=snapshot["career_peak_label"],
    )


class GuessGameService:
    """All database reads and mutations behind ``/api/guess``."""

    @staticmethod
    async def puzzle(
        db: AsyncSession, number: int | None = None
    ) -> GuessGamePuzzleResponse:
        target = (
            GuessGamePuzzle.published_on == puzzle_date()
            if number is None
            else GuessGamePuzzle.number == number
        )
        row = (
            await db.execute(
                select(
                    GuessGamePuzzle.id,
                    GuessGamePuzzle.public_id,
                    GuessGamePuzzle.number,
                    GuessGamePuzzle.published_on,
                    GuessGamePuzzle.max_guesses,
                )
                .where(
                    _published(),
                    target,
                )
                .order_by(
                    GuessGamePuzzle.published_on.desc(),
                    GuessGamePuzzle.number.desc(),
                )
                .limit(1)
            )
        ).one_or_none()
        if row is None:
            raise ValueError("Guess game not found")
        neighbours = (
            await db.execute(
                select(
                    func.max(GuessGamePuzzle.number).filter(
                        GuessGamePuzzle.number < row.number
                    ),
                    func.min(GuessGamePuzzle.number).filter(
                        GuessGamePuzzle.number > row.number
                    ),
                ).where(_published())
            )
        ).one()
        history = (
            await db.execute(
                select(GuessGamePuzzle.number, GuessGamePuzzle.published_on)
                .where(_published())
                .order_by(
                    GuessGamePuzzle.published_on.desc(),
                    GuessGamePuzzle.number.desc(),
                )
                .limit(5)
            )
        ).all()
        return GuessGamePuzzleResponse(
            id=row.public_id,
            number=row.number,
            published_on=row.published_on,
            max_guesses=row.max_guesses,
            previous_number=neighbours[0],
            next_number=neighbours[1],
            history=[
                {"number": item.number, "published_on": item.published_on}
                for item in history
            ],
        )

    @staticmethod
    async def catalog(db: AsyncSession):
        attributes = await DriverAttributeService.derive(db)
        return await GameDriverCatalogService.catalog(db, set(attributes))

    @staticmethod
    async def create_or_restore_session(
        db: AsyncSession,
        puzzle_id: str,
        user_id: int | None,
        anon_id: str | None,
        ranked: bool,
    ) -> GuessGameSessionResponse:
        if user_id is None and anon_id is None:
            raise ValueError("An anonymous player ID is required")
        puzzle = await db.scalar(
            select(GuessGamePuzzle).where(
                _published(),
                GuessGamePuzzle.public_id == puzzle_id,
            )
        )
        if puzzle is None:
            raise ValueError("Guess game not found")

        session = None
        if ranked:
            identity = (
                GuessGameSession.user_id == user_id
                if user_id is not None
                else GuessGameSession.anon_id == anon_id
            )
            session = await db.scalar(
                select(GuessGameSession)
                .options(selectinload(GuessGameSession.guesses))
                .where(
                    GuessGameSession.puzzle_id == puzzle.id,
                    GuessGameSession.ranked.is_(True),
                    identity,
                )
            )
        if session is None:
            session = GuessGameSession(
                puzzle_id=puzzle.id,
                user_id=user_id,
                anon_id=None if user_id is not None else anon_id,
                ranked=ranked,
                guesses=[],
            )
            db.add(session)
            try:
                await db.commit()
                await db.refresh(session, attribute_names=["guesses"])
            except IntegrityError:
                await db.rollback()
                if not ranked:
                    raise
                identity = (
                    GuessGameSession.user_id == user_id
                    if user_id is not None
                    else GuessGameSession.anon_id == anon_id
                )
                session = await db.scalar(
                    select(GuessGameSession)
                    .options(selectinload(GuessGameSession.guesses))
                    .where(
                        GuessGameSession.puzzle_id == puzzle.id,
                        GuessGameSession.ranked.is_(True),
                        identity,
                    )
                )
                if session is None:
                    raise
        return await GuessGameService._session_response(db, session, puzzle)

    @staticmethod
    async def submit_guess(
        db: AsyncSession,
        session_id: UUID,
        driver_slug: str,
        user_id: int | None,
        anon_id: str | None,
    ) -> GuessGameGuessResponse:
        session = await db.scalar(
            select(GuessGameSession)
            .options(selectinload(GuessGameSession.guesses))
            .where(GuessGameSession.public_id == session_id)
            .with_for_update()
        )
        if session is None:
            raise ValueError("Game session not found")
        assert_session_owner(session, user_id, anon_id)
        if session.finished_at is not None:
            raise ValueError("This game is already finished")
        puzzle = await db.get(GuessGamePuzzle, session.puzzle_id)
        if puzzle is None or puzzle.status != "published" or not puzzle.answer_snapshot:
            raise ValueError("Guess game not found")
        normalized = driver_slug.strip().lower()
        guessed_driver = await db.scalar(
            select(Driver).where(Driver.slug == normalized)
        )
        if guessed_driver is None:
            raise LookupError("Driver not found")
        if any(
            guess.guessed_driver_id == guessed_driver.id for guess in session.guesses
        ):
            raise ValueError("That driver has already been guessed")
        if session.guesses_used >= puzzle.max_guesses:
            raise ValueError("No guesses remain")

        attribute_map = await DriverAttributeService.derive(
            db, [guessed_driver.id, puzzle.answer_driver_id]
        )
        guessed = attribute_map.get(guessed_driver.id)
        answer_attributes = attribute_map.get(puzzle.answer_driver_id)
        if guessed is None:
            raise ValueError("That driver does not have complete comparison data")
        candidates = await DriverFactService.candidates(db, guessed, answer_attributes)
        recent_categories = [
            guess.selected_fact_id.split(".", 1)[0] for guess in session.guesses[-3:]
        ]
        fact = DriverFactService.select_fact(
            candidates, puzzle.public_id, guessed.driver_id, recent_categories
        )
        correct = guessed.driver_id == puzzle.answer_driver_id
        sequence = session.guesses_used + 1
        exhausted = not correct and sequence >= puzzle.max_guesses
        highlights = (
            (await DriverFactService.highlights(db, guessed))[:WINNER_HIGHLIGHT_LIMIT]
            if correct
            else []
        )
        snapshot = {
            "values": guessed.snapshot(),
            "comparisons": DriverAttributeService.compare(
                guessed, puzzle.answer_snapshot
            ),
            "highlights": [
                {"id": item.id, "value": item.value, "label": item.label}
                for item in highlights
                if item.value and item.label
            ],
        }
        record = GuessGameGuess(
            session_id=session.id,
            sequence=sequence,
            guessed_driver_id=guessed.driver_id,
            comparison_snapshot=snapshot,
            selected_fact_id=fact.id,
            rendered_fact_text=fact.text,
            constructor_color=guessed.signature_constructor.color,
            correct=correct,
        )
        db.add(record)
        session.guesses_used = sequence
        if correct:
            finish_session(session, "won", won=True)
        elif exhausted:
            finish_session(session, "exhausted", won=False)
        await db.commit()
        await db.refresh(record)
        return await GuessGameService._guess_response(
            db,
            record,
            puzzle.answer_snapshot,
            reveal=correct or exhausted,
        )

    @staticmethod
    async def _driver_response(db: AsyncSession, driver_id: int) -> GameDriver:
        driver = await db.get(Driver, driver_id)
        if driver is None:
            raise ValueError("Driver not found")
        ref = await MediaService.resolve(db, driver.id, None, "headshot")
        media = DriverMedia.from_ref(ref)
        return GameDriver(
            driver_slug=driver.slug,
            full_name=driver.full_name,
            driver_code=driver.driver_code,
            headshot_url=media.url if media else None,
            media=media,
        )

    @staticmethod
    async def _guess_response(
        db: AsyncSession,
        guess: GuessGameGuess,
        answer_snapshot: dict,
        *,
        reveal: bool,
    ) -> GuessGameGuessResponse:
        frozen = guess.comparison_snapshot
        highlights = [
            GuessGameHighlight(**item)
            for item in frozen.get("highlights", [])[:WINNER_HIGHLIGHT_LIMIT]
        ]
        return GuessGameGuessResponse(
            sequence=guess.sequence,
            correct=guess.correct,
            driver=await GuessGameService._driver_response(db, guess.guessed_driver_id),
            values=_values(frozen["values"]),
            comparisons=frozen["comparisons"],
            fact=GuessGameFact(
                id=guess.selected_fact_id,
                text=guess.rendered_fact_text,
                constructor_color=guess.constructor_color,
            ),
            answer=_answer(answer_snapshot) if reveal else None,
            highlights=highlights if guess.correct else None,
        )

    @staticmethod
    async def _session_response(
        db: AsyncSession,
        session: GuessGameSession,
        puzzle: GuessGamePuzzle,
    ) -> GuessGameSessionResponse:
        status = session.completion_reason or "active"
        guesses = []
        for index, guess in enumerate(session.guesses):
            guesses.append(
                await GuessGameService._guess_response(
                    db,
                    guess,
                    puzzle.answer_snapshot,
                    reveal=session.finished_at is not None
                    and index == len(session.guesses) - 1,
                )
            )
        return GuessGameSessionResponse(
            session_id=session.public_id,
            puzzle_id=puzzle.public_id,
            max_guesses=puzzle.max_guesses,
            status=status,
            guesses=guesses,
            answer=(
                _answer(puzzle.answer_snapshot)
                if session.finished_at is not None
                else None
            ),
        )

    @staticmethod
    async def stats(
        db: AsyncSession, user_id: int | None, anon_id: str | None
    ) -> DailyGamePersonalStats:
        if user_id is None and anon_id is None:
            raise ValueError("An anonymous player ID is required")
        identity = (
            GuessGameSession.user_id == user_id
            if user_id is not None
            else GuessGameSession.anon_id == anon_id
        )
        rows = (
            await db.execute(
                select(GuessGameSession, GuessGamePuzzle.published_on)
                .join(GuessGamePuzzle)
                .where(
                    identity,
                    GuessGameSession.ranked.is_(True),
                    GuessGameSession.finished_at.is_not(None),
                )
                .order_by(GuessGamePuzzle.published_on)
            )
        ).all()
        summary = summarize_sessions(
            rows,
            played_on=lambda row: row.published_on,
            is_win=lambda row: bool(row.GuessGameSession.won),
            score=lambda row: row.GuessGameSession.guesses_used,
            current_day=puzzle_date(),
        )
        aggregate_count = int(
            await db.scalar(
                select(func.count())
                .select_from(GuessGameSession)
                .where(
                    GuessGameSession.ranked.is_(True),
                    GuessGameSession.finished_at.is_not(None),
                )
            )
            or 0
        )
        aggregate = None
        if aggregate_count >= GLOBAL_DISTRIBUTION_MINIMUM:
            distribution = (
                await db.execute(
                    select(GuessGameSession.guesses_used, func.count())
                    .where(
                        GuessGameSession.ranked.is_(True),
                        GuessGameSession.won.is_(True),
                    )
                    .group_by(GuessGameSession.guesses_used)
                )
            ).all()
            aggregate = {int(score): int(count) for score, count in distribution}
        return DailyGamePersonalStats(
            **summary.__dict__, aggregate_distribution=aggregate
        )

    @staticmethod
    async def leaderboard(
        db: AsyncSession, puzzle_id: str, offset: int, limit: int
    ) -> DailyGameLeaderboardResponse:
        puzzle = await db.scalar(
            select(GuessGamePuzzle).where(
                _published(), GuessGamePuzzle.public_id == puzzle_id
            )
        )
        if puzzle is None:
            raise ValueError("Guess game not found")
        filters = (
            GuessGameSession.puzzle_id == puzzle.id,
            GuessGameSession.ranked.is_(True),
            GuessGameSession.finished_at.is_not(None),
            GuessGameSession.user_id.is_not(None),
        )
        total = int(
            await db.scalar(
                select(func.count()).select_from(GuessGameSession).where(*filters)
            )
            or 0
        )
        rows = (
            await db.execute(
                select(GuessGameSession, User.username)
                .join(User, User.id == GuessGameSession.user_id)
                .where(*filters)
                .order_by(
                    GuessGameSession.won.desc(),
                    GuessGameSession.guesses_used,
                    GuessGameSession.elapsed_ms,
                    GuessGameSession.public_id,
                )
                .offset(offset)
                .limit(limit)
            )
        ).all()
        return leaderboard_page(
            rows,
            total=total,
            offset=offset,
            limit=limit,
            display_name=lambda row: row.username,
            is_win=lambda row: bool(row.GuessGameSession.won),
            score=lambda row: row.GuessGameSession.guesses_used,
            elapsed_ms=lambda row: row.GuessGameSession.elapsed_ms or 0,
        )
