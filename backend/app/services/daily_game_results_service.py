"""Shared completion, statistics, and ranking rules for Daily Games."""

from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Callable, Iterable, TypeVar

from app.schemas.daily_games import (
    DailyGameLeaderboardEntry,
    DailyGameLeaderboardResponse,
)

SessionT = TypeVar("SessionT")


@dataclass(frozen=True)
class DailyGameStats:
    played: int
    won: int
    win_percentage: float
    current_streak: int
    max_streak: int
    distribution: dict[int, int]


def elapsed_milliseconds(started_at: datetime, finished_at: datetime) -> int:
    return max(0, round((finished_at - started_at).total_seconds() * 1000))


def finish_session(
    session: object,
    reason: str,
    *,
    won: bool,
    now: datetime | None = None,
) -> None:
    """Apply the identical server-owned clock rule to either game's model."""
    finished = now or datetime.now(timezone.utc)
    session.finished_at = finished
    if hasattr(session, "completion_reason"):
        session.completion_reason = reason
    else:
        session.exit_reason = reason
    if hasattr(session, "won"):
        session.won = won
    session.elapsed_ms = elapsed_milliseconds(session.started_at, finished)


def assert_session_owner(
    session: object, user_id: int | None, anon_id: str | None
) -> None:
    """Apply one ownership rule to mutations in either daily game."""
    session_user_id = getattr(session, "user_id", None)
    if session_user_id is not None:
        allowed = session_user_id == user_id
    else:
        allowed = bool(anon_id) and getattr(session, "anon_id", None) == anon_id
    if not allowed:
        raise PermissionError("This game session belongs to another player")


def leaderboard_page(
    rows: Iterable[SessionT],
    *,
    total: int,
    offset: int,
    limit: int,
    display_name: Callable[[SessionT], str],
    is_win: Callable[[SessionT], bool],
    score: Callable[[SessionT], int],
    elapsed_ms: Callable[[SessionT], int],
) -> DailyGameLeaderboardResponse:
    """Number and serialize either game's already ordered leaderboard rows."""
    return DailyGameLeaderboardResponse(
        entries=[
            DailyGameLeaderboardEntry(
                rank=offset + index + 1,
                display_name=display_name(row),
                won=is_win(row),
                score=score(row),
                elapsed_ms=elapsed_ms(row),
            )
            for index, row in enumerate(rows)
        ],
        total=total,
        offset=offset,
        limit=limit,
    )


def summarize_sessions(
    sessions: Iterable[SessionT],
    *,
    played_on: Callable[[SessionT], date],
    is_win: Callable[[SessionT], bool],
    score: Callable[[SessionT], int],
    current_day: date | None = None,
) -> DailyGameStats:
    """One streak/distribution implementation shared by both games."""
    rows = list(sessions)
    won_rows = [row for row in rows if is_win(row)]
    wins_by_day = sorted({played_on(row) for row in won_rows})
    longest = 0
    run = 0
    previous: date | None = None
    for day in wins_by_day:
        run = run + 1 if previous and (day - previous).days == 1 else 1
        longest = max(longest, run)
        previous = day
    current = run if wins_by_day else 0
    today = current_day or date.today()
    if wins_by_day and (today - wins_by_day[-1]).days > 1:
        current = 0
    distribution = Counter(score(row) for row in won_rows)
    played = len(rows)
    won = len(won_rows)
    return DailyGameStats(
        played=played,
        won=won,
        win_percentage=round((won / played) * 100, 1) if played else 0,
        current_streak=current,
        max_streak=longest,
        distribution=dict(sorted(distribution.items())),
    )
