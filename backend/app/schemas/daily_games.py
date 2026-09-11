"""Contracts shared by Daily Games summary and result menus."""

from typing import Literal

from pydantic import BaseModel


class DailyGamePersonalStats(BaseModel):
    played: int
    won: int
    win_percentage: float
    current_streak: int
    max_streak: int
    distribution: dict[int, int]
    aggregate_distribution: dict[int, int] | None = None


class DailyGameLeaderboardEntry(BaseModel):
    rank: int
    display_name: str
    won: bool
    score: int
    elapsed_ms: int


class DailyGameLeaderboardResponse(BaseModel):
    entries: list[DailyGameLeaderboardEntry]
    total: int
    offset: int
    limit: int


class DailyGamesSummaryItem(BaseModel):
    game: Literal["grid", "guess"]
    name: str
    href: str
    state: Literal["not_started", "in_progress", "complete"]
    puzzle_number: int | None
    published_on: str | None


class DailyGamesSummaryResponse(BaseModel):
    games: list[DailyGamesSummaryItem]
