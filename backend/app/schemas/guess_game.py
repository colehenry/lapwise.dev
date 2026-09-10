"""Purpose-built contracts for the guess game."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.daily_games import (
    DailyGameLeaderboardResponse,
    DailyGamePersonalStats,
)
from app.schemas.daily_grid import GameDriver, GameDriverCatalogResponse


class GuessGamePuzzleResponse(BaseModel):
    id: str
    number: int
    published_on: date
    max_guesses: int
    previous_number: int | None
    next_number: int | None


class GuessGameComparison(BaseModel):
    state: Literal["exact", "close", "miss"]
    direction: Literal["higher", "lower"] | None = None


class GuessGameComparisons(BaseModel):
    debut: GuessGameComparison
    last_raced: GuessGameComparison
    country: GuessGameComparison
    constructor: GuessGameComparison
    career_peak: GuessGameComparison


class GuessGameValues(BaseModel):
    debut: int
    last_raced: int
    country: str
    constructor: str
    career_peak: str


class GuessGameFact(BaseModel):
    id: str
    text: str
    constructor_color: str | None = None


class GuessGameHighlight(BaseModel):
    id: str
    value: str
    label: str


class GuessGameAnswer(BaseModel):
    driver_slug: str
    full_name: str
    driver_code: str | None


class GuessGameGuessResponse(BaseModel):
    sequence: int
    correct: bool
    driver: GameDriver
    values: GuessGameValues
    comparisons: GuessGameComparisons
    fact: GuessGameFact
    answer: GuessGameAnswer | None = None
    highlights: list[GuessGameHighlight] | None = None


class GuessGameSessionRequest(BaseModel):
    puzzle_id: str = Field(min_length=1, max_length=40)
    anon_id: str | None = Field(default=None, min_length=16, max_length=64)
    ranked: bool = True


class GuessGameSessionResponse(BaseModel):
    session_id: UUID
    puzzle_id: str
    max_guesses: int
    status: Literal["active", "won", "exhausted", "retired"]
    guesses: list[GuessGameGuessResponse]
    answer: GuessGameAnswer | None = None


class GuessGameGuessRequest(BaseModel):
    session_id: UUID
    driver_slug: str = Field(min_length=1, max_length=120)
    anon_id: str | None = Field(default=None, min_length=16, max_length=64)


GuessGameCatalogResponse = GameDriverCatalogResponse
GuessGameStatsResponse = DailyGamePersonalStats
GuessGameLeaderboardResponse = DailyGameLeaderboardResponse
