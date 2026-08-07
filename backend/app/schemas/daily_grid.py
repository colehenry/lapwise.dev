"""Public contracts for the Lapwise Daily Grid."""

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.media import DriverMedia


class GameCategoryVisual(BaseModel):
    kind: Literal["constructor", "nationality", "text"]
    value: str


class GameCategory(BaseModel):
    id: str
    label: str
    prompt_label: str
    description: str
    visual: GameCategoryVisual


class DailyGameResponse(BaseModel):
    id: str
    number: int
    published_on: date
    answer_version: int
    max_guesses: int
    previous_number: int | None
    next_number: int | None
    # False on boards frozen before Rookie Mode, which hides the toggle rather
    # than offering a mode the board cannot serve.
    has_rookie_mode: bool = False
    rows: list[GameCategory]
    columns: list[GameCategory]


class GameDriver(BaseModel):
    driver_slug: str
    full_name: str
    driver_code: str | None
    # Retained for compatibility while consumers migrate to `media`.
    headshot_url: str | None
    media: DriverMedia | None = None


class GameDriverSearchResponse(BaseModel):
    drivers: list[GameDriver]


class GameDriverCatalogItem(GameDriver):
    race_entries: int


class GameDriverCatalogResponse(BaseModel):
    drivers: list[GameDriverCatalogItem]


class GameGuessRequest(BaseModel):
    puzzle_id: str = Field(min_length=1, max_length=40)
    row_id: str = Field(min_length=1, max_length=80)
    column_id: str = Field(min_length=1, max_length=80)
    driver_slug: str = Field(min_length=1, max_length=120)


class RookieOptionsResponse(BaseModel):
    """Per-cell option lists keyed by `row__column`.

    Evidence is deliberately absent: it is returned with a guess result, after
    the player has committed, because proof attached to an unplayed option is
    the answer.
    """

    puzzle_id: str
    options: dict[str, list[GameDriver]]


class GameGuessResponse(BaseModel):
    correct: bool
    row_id: str
    column_id: str
    driver: GameDriver
    # Resolved facts proving or disproving each header. None where the board
    # carries no frozen evidence for this driver, which degrades to the
    # correct/incorrect result alone.
    row_evidence: dict[str, Any] | None = None
    column_evidence: dict[str, Any] | None = None
