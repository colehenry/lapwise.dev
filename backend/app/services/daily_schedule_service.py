"""One schedule shape for both Daily Games.

A puzzle is either undated (a draft) or dated (published). A dated puzzle is
live once its date arrives and scheduled until then; the date gate in each
player service is the whole publication mechanism.

The upcoming run is contiguous. Approving appends to the end of it, moving a
puzzle onto a day slots it in there, and removing one closes the gap it
leaves. Nothing on or before today moves: those dates have been served.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Awaitable, Callable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.daily_game_clock import puzzle_date

# Called before a puzzle takes a date for the first time.
Prepare = Callable[[AsyncSession, int], Awaitable[None]]

# Further out than any run will reach.
PARKING_OFFSET = timedelta(days=10_000)


@dataclass(frozen=True)
class ScheduledGame:
    """The two tables a game keeps, and what to do before its first date."""

    label: str
    puzzle: type
    session: type
    prepare: Prepare | None = None


class DailyScheduleService:
    def __init__(self, game: ScheduledGame):
        self.game = game

    async def _puzzle(self, db: AsyncSession, number: int):
        model = self.game.puzzle
        puzzle = await db.scalar(select(model).where(model.number == number))
        if puzzle is None:
            raise ValueError(f"{self.game.label} #{number} not found")
        return puzzle

    async def _played(self, db: AsyncSession, puzzle) -> int:
        session = self.game.session
        return int(
            await db.scalar(
                select(func.count(session.id)).where(session.puzzle_id == puzzle.id)
            )
            or 0
        )

    async def _refuse_if_played(self, db: AsyncSession, puzzle, action: str) -> None:
        """A puzzle with one recorded attempt is a result, not a proposal."""
        played = await self._played(db, puzzle)
        if played:
            raise ValueError(
                f"{self.game.label} #{puzzle.number} has {played} recorded session"
                f"{'' if played == 1 else 's'} and cannot be {action}"
            )

    async def _upcoming(self, db: AsyncSession) -> list:
        """Dated puzzles after today, in date order."""
        model = self.game.puzzle
        return list(
            (
                await db.scalars(
                    select(model)
                    .where(
                        model.status == "published",
                        model.published_on > puzzle_date(),
                    )
                    .order_by(model.published_on)
                )
            ).all()
        )

    async def _first_open_day(self, db: AsyncSession) -> date:
        """Today if nothing runs today, otherwise tomorrow."""
        model = self.game.puzzle
        today = puzzle_date()
        taken = await db.scalar(
            select(model.number).where(
                model.status == "published", model.published_on == today
            )
        )
        return today if taken is None else today + timedelta(days=1)

    async def _holder(self, db: AsyncSession, on: date, exclude: int) -> int | None:
        """The number of the other puzzle published on a day, if any."""
        model = self.game.puzzle
        return await db.scalar(
            select(model.number).where(
                model.status == "published",
                model.published_on == on,
                model.number != exclude,
            )
        )

    async def _lay_out(self, db: AsyncSession, upcoming: list) -> None:
        """Date the upcoming run contiguously from the first open day.

        Two passes: the unique index on published dates fires per row, so two
        puzzles swapping places collide mid-way. Parking the run far out
        first keeps every intermediate state legal.
        """
        for offset, puzzle in enumerate(upcoming):
            puzzle.published_on = (
                puzzle_date() + PARKING_OFFSET + timedelta(days=offset)
            )
        await db.flush()
        start = await self._first_open_day(db)
        for offset, puzzle in enumerate(upcoming):
            puzzle.published_on = start + timedelta(days=offset)
        await db.flush()

    def _stamp(self, puzzle, reviewer_id: int | None) -> None:
        puzzle.status = "published"
        puzzle.reviewed_at = datetime.now(timezone.utc)
        puzzle.reviewed_by_id = reviewer_id

    async def approve(self, db: AsyncSession, number: int, reviewer_id: int | None):
        """Append the puzzle to the upcoming run."""
        puzzle = await self._puzzle(db, number)
        if puzzle.published_on is not None:
            raise ValueError(f"{self.game.label} #{number} already has a date")
        if self.game.prepare is not None:
            await self.game.prepare(db, number)
            await db.refresh(puzzle)
        upcoming = await self._upcoming(db)
        self._stamp(puzzle, reviewer_id)
        await self._lay_out(db, upcoming + [puzzle])
        await db.commit()
        return puzzle

    async def move(
        self, db: AsyncSession, number: int, on: date, reviewer_id: int | None
    ):
        """Put a puzzle on a day.

        A day on or before today is set directly, which is how a board is
        published now or backdated into the archive. A later day is a position
        in the upcoming run: the puzzle takes that slot and the rest close up
        around it, so the run stays contiguous.
        """
        puzzle = await self._puzzle(db, number)
        await self._refuse_if_played(db, puzzle, "moved")
        today = puzzle_date()
        if on <= today:
            clash = await self._holder(db, on, number)
            if clash is not None:
                raise ValueError(f"{self.game.label} #{clash} already runs on {on}")
        if puzzle.published_on is None and self.game.prepare is not None:
            await self.game.prepare(db, number)
            await db.refresh(puzzle)
        self._stamp(puzzle, reviewer_id)

        upcoming = [
            entry for entry in await self._upcoming(db) if entry.number != number
        ]
        if on <= today:
            puzzle.published_on = on
            await db.flush()
            await self._lay_out(db, upcoming)
        else:
            # Off its current day first, so a puzzle leaving today frees it.
            puzzle.published_on = today + PARKING_OFFSET - timedelta(days=1)
            await db.flush()
            start = await self._first_open_day(db)
            slot = max(0, min((on - start).days, len(upcoming)))
            upcoming.insert(slot, puzzle)
            await self._lay_out(db, upcoming)
        await db.commit()
        return puzzle

    async def unschedule(self, db: AsyncSession, number: int):
        """Back to draft. The run closes up behind it."""
        puzzle = await self._puzzle(db, number)
        await self._refuse_if_played(db, puzzle, "unscheduled")
        puzzle.status = "draft"
        puzzle.published_on = None
        puzzle.reviewed_at = None
        puzzle.reviewed_by_id = None
        await db.flush()
        await self._lay_out(db, await self._upcoming(db))
        await db.commit()
        return puzzle

    async def delete(self, db: AsyncSession, number: int) -> None:
        """Remove a puzzle at any status, provided nobody has played it."""
        puzzle = await self._puzzle(db, number)
        await self._refuse_if_played(db, puzzle, "deleted")
        await db.delete(puzzle)
        await db.flush()
        await self._lay_out(db, await self._upcoming(db))
        await db.commit()

    async def delete_drafts(self, db: AsyncSession) -> int:
        """Clear the unreviewed queue in one action."""
        model = self.game.puzzle
        drafts = list(
            (
                await db.scalars(
                    select(model).where(model.status == "draft").order_by(model.number)
                )
            ).all()
        )
        removed = 0
        for puzzle in drafts:
            if await self._played(db, puzzle):
                continue
            await db.delete(puzzle)
            removed += 1
        await db.commit()
        return removed
