"""One lightweight state summary for the Daily Games surfaces."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GameSession, GuessGamePuzzle, GuessGameSession, Puzzle
from app.schemas.daily_games import DailyGamesSummaryItem, DailyGamesSummaryResponse
from app.services.daily_game_clock import puzzle_date


def _state(session, progress: int) -> str:
    if session is None:
        return "not_started"
    if session.finished_at is not None:
        return "complete"
    return "in_progress" if progress > 0 else "not_started"


class DailyGamesService:
    """Orchestrate game services without making clients join responses."""

    @staticmethod
    async def summary(
        db: AsyncSession, user_id: int | None, anon_id: str | None
    ) -> DailyGamesSummaryResponse:
        today = puzzle_date()
        grid = await db.scalar(
            select(Puzzle)
            .where(Puzzle.status == "published", Puzzle.published_on <= today)
            .order_by(Puzzle.published_on.desc(), Puzzle.number.desc())
            .limit(1)
        )
        guess = await db.scalar(
            select(GuessGamePuzzle)
            .where(
                GuessGamePuzzle.status == "published",
                GuessGamePuzzle.published_on <= today,
            )
            .order_by(
                GuessGamePuzzle.published_on.desc(),
                GuessGamePuzzle.number.desc(),
            )
            .limit(1)
        )
        grid_session = None
        guess_session = None
        if user_id is not None or anon_id is not None:
            if grid:
                identity = (
                    GameSession.user_id == user_id
                    if user_id is not None
                    else GameSession.anon_id == anon_id
                )
                grid_session = await db.scalar(
                    select(GameSession)
                    .where(
                        GameSession.puzzle_id == grid.id,
                        GameSession.mode == "standard",
                        GameSession.ranked.is_(True),
                        identity,
                    )
                    .limit(1)
                )
            if guess:
                identity = (
                    GuessGameSession.user_id == user_id
                    if user_id is not None
                    else GuessGameSession.anon_id == anon_id
                )
                guess_session = await db.scalar(
                    select(GuessGameSession)
                    .where(
                        GuessGameSession.puzzle_id == guess.id,
                        GuessGameSession.ranked.is_(True),
                        identity,
                    )
                    .limit(1)
                )
        return DailyGamesSummaryResponse(
            games=[
                DailyGamesSummaryItem(
                    game="grid",
                    name="Daily Grid",
                    href="/daily",
                    state=_state(
                        grid_session,
                        (grid_session.cells_solved + grid_session.misses)
                        if grid_session
                        else 0,
                    ),
                    puzzle_number=grid.number if grid else None,
                    published_on=(
                        grid.published_on.isoformat()
                        if grid and grid.published_on
                        else None
                    ),
                ),
                DailyGamesSummaryItem(
                    game="guess",
                    name="Who's on Pole?",
                    href="/guess",
                    state=_state(
                        guess_session,
                        guess_session.guesses_used if guess_session else 0,
                    ),
                    puzzle_number=guess.number if guess else None,
                    published_on=(
                        guess.published_on.isoformat()
                        if guess and guess.published_on
                        else None
                    ),
                ),
            ]
        )
