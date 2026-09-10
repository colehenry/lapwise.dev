"""Server-owned Daily Grid sessions, statistics, and leaderboard."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import GameSession, GameSessionGuess, Puzzle, User
from app.schemas.daily_games import (
    DailyGameLeaderboardResponse,
    DailyGamePersonalStats,
)
from app.schemas.daily_grid import (
    GameDriver,
    GameGuessResponse,
    GridSessionResponse,
)
from app.services.daily_game_clock import puzzle_date
from app.services.daily_game_results_service import (
    assert_session_owner,
    finish_session,
    leaderboard_page,
    summarize_sessions,
)

MISS_PENALTY_SECONDS = 5


def _published():
    return (Puzzle.status == "published") & (Puzzle.published_on <= puzzle_date())


class DailyGridSessionService:
    """Persistence shared by the Grid UI and its result menus."""

    @staticmethod
    async def create_or_restore(
        db: AsyncSession,
        puzzle_id: str,
        mode: str,
        user_id: int | None,
        anon_id: str | None,
        ranked: bool,
    ) -> GridSessionResponse:
        if user_id is None and anon_id is None:
            raise ValueError("An anonymous player ID is required")
        puzzle = await db.scalar(
            select(Puzzle).where(_published(), Puzzle.public_id == puzzle_id)
        )
        if puzzle is None:
            raise ValueError("Grid not found")
        if mode == "rookie" and not puzzle.rookie_options:
            raise ValueError("This grid has no rookie mode")
        session = None
        if ranked:
            identity = (
                GameSession.user_id == user_id
                if user_id is not None
                else GameSession.anon_id == anon_id
            )
            session = await db.scalar(
                select(GameSession)
                .options(selectinload(GameSession.guesses))
                .where(
                    GameSession.puzzle_id == puzzle.id,
                    GameSession.mode == mode,
                    GameSession.ranked.is_(True),
                    identity,
                )
            )
        if session is None:
            session = GameSession(
                puzzle_id=puzzle.id,
                mode=mode,
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
                    GameSession.user_id == user_id
                    if user_id is not None
                    else GameSession.anon_id == anon_id
                )
                session = await db.scalar(
                    select(GameSession)
                    .options(selectinload(GameSession.guesses))
                    .where(
                        GameSession.puzzle_id == puzzle.id,
                        GameSession.mode == mode,
                        GameSession.ranked.is_(True),
                        identity,
                    )
                )
                if session is None:
                    raise
        return DailyGridSessionService._response(session, puzzle)

    @staticmethod
    def _guess_response(record: GameSessionGuess) -> GameGuessResponse:
        if record.result_snapshot:
            return GameGuessResponse(**record.result_snapshot)
        return GameGuessResponse(
            correct=record.correct,
            row_id=record.row_id,
            column_id=record.column_id,
            driver=GameDriver(
                driver_slug=record.driver_slug,
                full_name=record.driver_slug.replace("-", " ").title(),
                driver_code=None,
                headshot_url=None,
            ),
        )

    @staticmethod
    def _response(session: GameSession, puzzle: Puzzle) -> GridSessionResponse:
        return GridSessionResponse(
            session_id=session.public_id,
            puzzle_id=puzzle.public_id,
            mode=session.mode,
            status=session.exit_reason or "active",
            attempts=[
                DailyGridSessionService._guess_response(guess)
                for guess in session.guesses
            ],
            max_guesses=puzzle.max_guesses,
            cells_solved=session.cells_solved,
            misses=session.misses,
        )

    @staticmethod
    async def record_guess(
        db: AsyncSession,
        session_id: UUID,
        puzzle_id: str,
        result: GameGuessResponse,
        user_id: int | None,
        anon_id: str | None,
    ) -> None:
        session = await db.scalar(
            select(GameSession)
            .options(selectinload(GameSession.guesses))
            .where(GameSession.public_id == session_id)
            .with_for_update()
        )
        if session is None:
            raise ValueError("Game session not found")
        assert_session_owner(session, user_id, anon_id)
        puzzle = await db.get(Puzzle, session.puzzle_id)
        if puzzle is None or puzzle.public_id != puzzle_id:
            raise ValueError("Session does not belong to this grid")
        if session.finished_at is not None:
            raise ValueError("This grid is already finished")
        if len(session.guesses) >= puzzle.max_guesses:
            raise ValueError("No guesses remain")
        if any(
            guess.correct
            and guess.row_id == result.row_id
            and guess.column_id == result.column_id
            for guess in session.guesses
        ):
            raise ValueError("That grid cell is already solved")
        if result.correct and any(
            guess.correct and guess.driver_slug == result.driver.driver_slug
            for guess in session.guesses
        ):
            raise ValueError("That driver is already placed on this grid")
        sequence = len(session.guesses) + 1
        record = GameSessionGuess(
            session_id=session.id,
            sequence=sequence,
            row_id=result.row_id,
            column_id=result.column_id,
            driver_slug=result.driver.driver_slug,
            correct=result.correct,
            result_snapshot=result.model_dump(mode="json"),
        )
        db.add(record)
        if result.correct:
            session.cells_solved += 1
        else:
            session.misses += 1
            session.penalty_seconds += MISS_PENALTY_SECONDS
        if session.cells_solved == 9:
            finish_session(session, "complete", won=True)
        elif sequence >= puzzle.max_guesses:
            finish_session(session, "exhausted", won=False)
        await db.commit()

    @staticmethod
    async def retire(
        db: AsyncSession,
        session_id: UUID,
        user_id: int | None,
        anon_id: str | None,
    ) -> None:
        session = await db.scalar(
            select(GameSession)
            .where(GameSession.public_id == session_id)
            .with_for_update()
        )
        if session is None:
            raise ValueError("Game session not found")
        assert_session_owner(session, user_id, anon_id)
        if session.finished_at is None:
            finish_session(session, "retired", won=False)
            await db.commit()

    @staticmethod
    async def stats(
        db: AsyncSession, mode: str, user_id: int | None, anon_id: str | None
    ) -> DailyGamePersonalStats:
        if user_id is None and anon_id is None:
            raise ValueError("An anonymous player ID is required")
        identity = (
            GameSession.user_id == user_id
            if user_id is not None
            else GameSession.anon_id == anon_id
        )
        rows = (
            await db.execute(
                select(GameSession, Puzzle.published_on)
                .join(Puzzle)
                .where(
                    identity,
                    GameSession.mode == mode,
                    GameSession.ranked.is_(True),
                    GameSession.finished_at.is_not(None),
                )
                .order_by(Puzzle.published_on)
            )
        ).all()
        summary = summarize_sessions(
            rows,
            played_on=lambda row: row.published_on,
            is_win=lambda row: row.GameSession.cells_solved == 9,
            score=lambda row: row.GameSession.cells_solved + row.GameSession.misses,
            current_day=puzzle_date(),
        )
        return DailyGamePersonalStats(**summary.__dict__)

    @staticmethod
    async def leaderboard(
        db: AsyncSession,
        puzzle_id: str,
        mode: str,
        offset: int,
        limit: int,
    ) -> DailyGameLeaderboardResponse:
        puzzle = await db.scalar(
            select(Puzzle).where(_published(), Puzzle.public_id == puzzle_id)
        )
        if puzzle is None:
            raise ValueError("Grid not found")
        filters = (
            GameSession.puzzle_id == puzzle.id,
            GameSession.mode == mode,
            GameSession.ranked.is_(True),
            GameSession.finished_at.is_not(None),
            GameSession.user_id.is_not(None),
        )
        total = int(
            await db.scalar(
                select(func.count()).select_from(GameSession).where(*filters)
            )
            or 0
        )
        adjusted = GameSession.elapsed_ms + GameSession.penalty_seconds * 1000
        rows = (
            await db.execute(
                select(GameSession, User.username, adjusted.label("adjusted_ms"))
                .join(User, User.id == GameSession.user_id)
                .where(*filters)
                .order_by(
                    GameSession.cells_solved.desc(),
                    adjusted,
                    GameSession.public_id,
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
            is_win=lambda row: row.GameSession.cells_solved == 9,
            score=lambda row: row.GameSession.cells_solved,
            elapsed_ms=lambda row: int(row.adjusted_ms or 0),
        )
