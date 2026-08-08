"""Editorial queue contracts for the Daily Grid.

Answers are exposed in full here, which is the opposite of the player contract.
A reviewer approving a board has to read the names: depth counts and validator
flags say a board is legal, not that it is good.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.daily_grid import GameCategory

PuzzleStatus = Literal["draft", "approved", "published"]


class PuzzleFinding(BaseModel):
    level: Literal["error", "warning"]
    code: str
    message: str


class PuzzleAnswer(BaseModel):
    """One accepted driver, with the facts the board gates turn on."""

    driver_slug: str
    full_name: str
    wins: int
    entries: int
    podiums: int
    first_season: int | None
    latest_season: int | None


class PuzzleCell(BaseModel):
    cell_id: str
    row_id: str
    column_id: str
    row_label: str
    column_label: str
    depth: int
    # Ordered by recognition, so the reviewer sees the names a player would
    # reach for first rather than an alphabetical list.
    answers: list[PuzzleAnswer]


class AdminPuzzleSummary(BaseModel):
    number: int
    public_id: str
    status: PuzzleStatus
    published_on: date | None
    eligibility_floor: int
    difficulty_score: int | None
    min_depth: int
    max_depth: int
    error_count: int
    warning_count: int
    created_at: datetime | None


class AdminPuzzleDetail(AdminPuzzleSummary):
    rows: list[GameCategory]
    columns: list[GameCategory]
    cells: list[PuzzleCell]
    findings: list[PuzzleFinding]


class AdminPuzzleListResponse(BaseModel):
    puzzles: list[AdminPuzzleSummary]


class PuzzleHeaderOption(BaseModel):
    """One header the generator may build a board from."""

    id: str
    label: str
    prompt_label: str
    kind: str
    # How many eligible drivers satisfy it on its own, before any intersection.
    depth: int


class PuzzleHeaderCatalogResponse(BaseModel):
    eligibility_floor: int
    pool_size: int
    headers: list[PuzzleHeaderOption]


class PuzzleGenerateRequest(BaseModel):
    """A generation run. Proposals land as drafts; nothing here publishes."""

    count: int = Field(default=7, ge=1, le=30)
    eligibility_floor: int = Field(default=1990, ge=1950, le=2100)
    # Boards are dated forward from here. A past date backdates them into the
    # archive, which is how a historical board is made.
    start_on: date | None = None
    theme: list[str] = Field(default_factory=list)
    # Fixes the run for reproducibility. Null means a different board set
    # every time, which is what a regenerate is asking for.
    seed: int | None = None


class PuzzleDeleteResponse(BaseModel):
    deleted: int


class PuzzleGenerateResponse(BaseModel):
    requested: int
    created: list[AdminPuzzleSummary]


class PuzzleScheduleRequest(BaseModel):
    """Approving a board is also dating it; the date gate does the publishing."""

    published_on: date
    status: Literal["approved", "published"] = "published"


class PuzzleStatusResponse(BaseModel):
    number: int
    status: PuzzleStatus
    published_on: date | None
    reviewed_at: datetime | None
    reviewed_by_id: int | None = Field(default=None)
