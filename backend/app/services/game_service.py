"""Daily grid discovery, driver search, and snapshot-based validation."""

import json
from functools import lru_cache
from pathlib import Path

from sqlalchemy import case, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Driver, Session, SessionResult
from app.schemas.game import (
    DailyGameResponse,
    GameCategory,
    GameDriver,
    GameDriverSearchResponse,
    GameGuessResponse,
)

_PUZZLE_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "game_puzzles" / "grid-001.json"
)


@lru_cache(maxsize=1)
def _puzzle() -> dict:
    with _PUZZLE_PATH.open(encoding="utf-8") as puzzle_file:
        return json.load(puzzle_file)


def _public_category(raw: dict) -> GameCategory:
    return GameCategory(
        id=raw["id"],
        label=raw["label"],
        description=raw["description"],
    )


def _driver_response(driver: Driver) -> GameDriver:
    return GameDriver(
        driver_slug=driver.slug,
        full_name=driver.full_name,
        driver_code=driver.driver_code,
        country_code=driver.country_code,
    )


def _escaped_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class GameService:
    """Serve one immutable puzzle snapshot without exposing its answer sets."""

    @staticmethod
    def daily_puzzle() -> DailyGameResponse:
        puzzle = _puzzle()
        return DailyGameResponse(
            id=puzzle["id"],
            number=puzzle["number"],
            published_on=puzzle["published_on"],
            answer_version=puzzle["answer_version"],
            max_guesses=puzzle["max_guesses"],
            rows=[_public_category(category) for category in puzzle["rows"]],
            columns=[_public_category(category) for category in puzzle["columns"]],
        )

    @staticmethod
    async def search_drivers(
        db: AsyncSession, query: str, limit: int = 12
    ) -> GameDriverSearchResponse:
        normalized = query.strip()
        if len(normalized) < 2:
            return GameDriverSearchResponse(drivers=[])

        lowered = normalized.lower()
        pattern = f"%{_escaped_like(normalized)}%"
        has_race_entry = exists(
            select(SessionResult.id)
            .join(Session, Session.id == SessionResult.session_id)
            .where(
                SessionResult.driver_id == Driver.id,
                Session.session_type == "race",
            )
        )
        statement = (
            select(Driver)
            .where(
                has_race_entry,
                or_(
                    Driver.full_name.ilike(pattern, escape="\\"),
                    Driver.slug.ilike(pattern, escape="\\"),
                    Driver.driver_code.ilike(pattern, escape="\\"),
                ),
            )
            .order_by(
                case(
                    (func.lower(Driver.full_name) == lowered, 0),
                    (func.lower(Driver.slug) == lowered, 1),
                    (func.lower(Driver.driver_code) == lowered, 2),
                    else_=3,
                ),
                Driver.full_name,
            )
            .limit(limit)
        )
        drivers = (await db.scalars(statement)).all()
        return GameDriverSearchResponse(
            drivers=[_driver_response(driver) for driver in drivers]
        )

    @staticmethod
    async def submit_guess(
        db: AsyncSession,
        row_id: str,
        column_id: str,
        driver_slug: str,
    ) -> GameGuessResponse | None:
        puzzle = _puzzle()
        cell_id = f"{row_id}__{column_id}"
        if cell_id not in puzzle["answers"]:
            raise ValueError("That row and column do not belong to this puzzle")

        normalized_slug = driver_slug.strip().lower()
        driver = await db.scalar(select(Driver).where(Driver.slug == normalized_slug))
        if driver is None:
            return None

        return GameGuessResponse(
            correct=normalized_slug in puzzle["answers"][cell_id],
            row_id=row_id,
            column_id=column_id,
            driver=_driver_response(driver),
        )
