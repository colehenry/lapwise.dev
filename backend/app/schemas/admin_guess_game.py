"""Admin-only Guess Game editorial contracts."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

GuessPuzzleStatus = Literal["draft", "approved", "published"]


class AdminGuessPuzzleSummary(BaseModel):
    number: int
    public_id: str
    status: GuessPuzzleStatus
    published_on: date | None
    max_guesses: int
    driver_slug: str
    full_name: str
    driver_code: str | None
    debut: int
    last_raced: int
    country: str
    constructor: str
    career_peak: str
    created_at: datetime | None


class AdminGuessPuzzleListResponse(BaseModel):
    puzzles: list[AdminGuessPuzzleSummary]


class AdminGuessPuzzleRandomizeRequest(BaseModel):
    count: int = Field(default=7, ge=1, le=30)
    seed: int | None = None


class AdminGuessPuzzleRandomizeResponse(BaseModel):
    requested: int
    eligible: int
    created: list[AdminGuessPuzzleSummary]


class AdminGuessPuzzleManualRequest(BaseModel):
    driver_slug: str = Field(min_length=1, max_length=120)
    published_on: date


class AdminGuessPuzzleScheduleRequest(BaseModel):
    published_on: date


class AdminGuessPuzzleStatusResponse(BaseModel):
    number: int
    status: GuessPuzzleStatus
    published_on: date | None
    reviewed_at: datetime | None
    reviewed_by_id: int | None


class AdminGuessPuzzleDeleteResponse(BaseModel):
    deleted: int
