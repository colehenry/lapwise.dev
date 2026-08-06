"""Public contracts for the Lapwise Daily Grid."""

from datetime import date
from typing import Literal

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


class GameGuessResponse(BaseModel):
    correct: bool
    row_id: str
    column_id: str
    driver: GameDriver
