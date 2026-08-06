"""Public contracts for the daily Lapwise Grid."""

from datetime import date

from pydantic import BaseModel, Field


class GameCategory(BaseModel):
    id: str
    label: str
    description: str


class DailyGameResponse(BaseModel):
    id: str
    number: int
    published_on: date
    answer_version: int
    max_guesses: int
    rows: list[GameCategory]
    columns: list[GameCategory]


class GameDriver(BaseModel):
    driver_slug: str
    full_name: str
    driver_code: str | None
    country_code: str | None


class GameDriverSearchResponse(BaseModel):
    drivers: list[GameDriver]


class GameGuessRequest(BaseModel):
    row_id: str = Field(min_length=1, max_length=80)
    column_id: str = Field(min_length=1, max_length=80)
    driver_slug: str = Field(min_length=1, max_length=120)


class GameGuessResponse(BaseModel):
    correct: bool
    row_id: str
    column_id: str
    driver: GameDriver
