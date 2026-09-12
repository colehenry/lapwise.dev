"""The upcoming run stays contiguous whatever the reviewer does to it.

Runs against fakes rather than the database: the service's queries are
replaced with an in-memory list so the tests exercise the dating rules
without touching a real schedule.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta

import pytest

from app.services import daily_schedule_service as module
from app.services.daily_schedule_service import DailyScheduleService, ScheduledGame

TODAY = date(2026, 9, 11)


@dataclass
class FakePuzzle:
    number: int
    status: str = "draft"
    published_on: date | None = None
    reviewed_at: object = None
    reviewed_by_id: int | None = None
    id: int = 0


@dataclass
class FakeDb:
    puzzles: list[FakePuzzle]
    played: set[int] = field(default_factory=set)
    prepared: list[int] = field(default_factory=list)

    async def flush(self):
        dates = [p.published_on for p in self.puzzles if p.status == "published"]
        assert len(dates) == len(set(dates)), "two published puzzles on one day"
        assert None not in dates, "a published puzzle without a date"

    async def commit(self):
        await self.flush()

    async def refresh(self, puzzle):
        pass

    async def delete(self, puzzle):
        self.puzzles.remove(puzzle)


@pytest.fixture
def service(monkeypatch):
    monkeypatch.setattr(module, "puzzle_date", lambda: TODAY)
    svc = DailyScheduleService(
        ScheduledGame(label="Fake", puzzle=object, session=object)
    )

    async def _puzzle(db, number):
        return next(p for p in db.puzzles if p.number == number)

    async def _played(db, puzzle):
        return 1 if puzzle.number in db.played else 0

    async def _upcoming(db):
        return sorted(
            (
                p
                for p in db.puzzles
                if p.status == "published"
                and p.published_on is not None
                and p.published_on > TODAY
            ),
            key=lambda p: p.published_on,
        )

    async def _first_open_day(db):
        taken = any(
            p.status == "published" and p.published_on == TODAY for p in db.puzzles
        )
        return TODAY + timedelta(days=1) if taken else TODAY

    async def _holder(db, on, exclude):
        return next(
            (
                p.number
                for p in db.puzzles
                if p.status == "published"
                and p.published_on == on
                and p.number != exclude
            ),
            None,
        )

    monkeypatch.setattr(svc, "_holder", _holder)
    monkeypatch.setattr(svc, "_puzzle", _puzzle)
    monkeypatch.setattr(svc, "_played", _played)
    monkeypatch.setattr(svc, "_upcoming", _upcoming)
    monkeypatch.setattr(svc, "_first_open_day", _first_open_day)
    return svc


def _dated(db: FakeDb) -> list[tuple[int, date]]:
    """The upcoming run in date order."""
    return sorted(
        (
            (p.number, p.published_on)
            for p in db.puzzles
            if p.status == "published" and p.published_on > TODAY
        ),
        key=lambda entry: entry[1],
    )


def _run(*numbers: int, start: date = TODAY + timedelta(days=1)) -> list[FakePuzzle]:
    return [
        FakePuzzle(number, "published", start + timedelta(days=offset))
        for offset, number in enumerate(numbers)
    ]


async def test_approving_appends_to_the_run(service):
    db = FakeDb([FakePuzzle(1, "published", TODAY), *_run(2, 3), FakePuzzle(9)])

    await service.approve(db, 9, reviewer_id=None)

    assert _dated(db) == [
        (2, TODAY + timedelta(days=1)),
        (3, TODAY + timedelta(days=2)),
        (9, TODAY + timedelta(days=3)),
    ]


async def test_approving_fills_today_when_nothing_runs(service):
    db = FakeDb([FakePuzzle(9)])

    await service.approve(db, 9, reviewer_id=None)

    assert db.puzzles[0].published_on == TODAY
    assert db.puzzles[0].status == "published"


async def test_approving_closes_gaps_left_by_hand(service):
    """Legacy dates with a hole in them come out contiguous."""
    db = FakeDb(
        [
            FakePuzzle(1, "published", TODAY),
            FakePuzzle(2, "published", TODAY + timedelta(days=1)),
            FakePuzzle(3, "published", TODAY + timedelta(days=5)),
            FakePuzzle(9),
        ]
    )

    await service.approve(db, 9, reviewer_id=None)

    assert [n for n, _ in _dated(db)] == [2, 3, 9]
    assert [d for _, d in _dated(db)] == [
        TODAY + timedelta(days=offset) for offset in (1, 2, 3)
    ]


async def test_moving_to_a_future_day_takes_that_slot(service):
    db = FakeDb([FakePuzzle(1, "published", TODAY), *_run(2, 3, 4), FakePuzzle(9)])

    await service.move(db, 9, TODAY + timedelta(days=2), reviewer_id=None)

    assert [n for n, _ in _dated(db)] == [2, 9, 3, 4]


async def test_moving_beyond_the_run_appends(service):
    db = FakeDb([FakePuzzle(1, "published", TODAY), *_run(2, 3), FakePuzzle(9)])

    await service.move(db, 9, TODAY + timedelta(days=40), reviewer_id=None)

    assert [n for n, _ in _dated(db)] == [2, 3, 9]
    assert db.puzzles[-1].published_on == TODAY + timedelta(days=3)


async def test_moving_within_the_run_closes_the_hole(service):
    db = FakeDb([FakePuzzle(1, "published", TODAY), *_run(2, 3, 4)])

    await service.move(db, 2, TODAY + timedelta(days=3), reviewer_id=None)

    assert [n for n, _ in _dated(db)] == [3, 4, 2]


async def test_moving_to_a_past_day_backdates(service):
    db = FakeDb([FakePuzzle(1, "published", TODAY), *_run(2, 3), FakePuzzle(9)])

    await service.move(db, 9, TODAY - timedelta(days=30), reviewer_id=None)

    assert db.puzzles[-1].published_on == TODAY - timedelta(days=30)
    assert [n for n, _ in _dated(db)] == [2, 3]


async def test_moving_onto_a_served_day_is_refused(service):
    db = FakeDb([FakePuzzle(1, "published", TODAY), FakePuzzle(9)])

    with pytest.raises(ValueError, match="already runs"):
        await service.move(db, 9, TODAY, reviewer_id=None)
    assert db.puzzles[-1].status == "draft"


async def test_unscheduling_closes_the_run(service):
    db = FakeDb([FakePuzzle(1, "published", TODAY), *_run(2, 3, 4)])

    await service.unschedule(db, 3)

    assert _dated(db) == [
        (2, TODAY + timedelta(days=1)),
        (4, TODAY + timedelta(days=2)),
    ]
    assert db.puzzles[2].status == "draft"
    assert db.puzzles[2].published_on is None


async def test_deleting_closes_the_run(service):
    db = FakeDb([FakePuzzle(1, "published", TODAY), *_run(2, 3, 4)])

    await service.delete(db, 2)

    assert _dated(db) == [
        (3, TODAY + timedelta(days=1)),
        (4, TODAY + timedelta(days=2)),
    ]


async def test_a_played_puzzle_never_moves(service):
    db = FakeDb([FakePuzzle(1, "published", TODAY)], played={1})

    for action in (
        service.unschedule(db, 1),
        service.delete(db, 1),
        service.move(db, 1, TODAY + timedelta(days=3), None),
    ):
        with pytest.raises(ValueError, match="recorded session"):
            await action


async def test_prepare_runs_once_before_the_first_date(monkeypatch, service):
    prepared = []

    async def prepare(db, number):
        prepared.append(number)

    service.game = ScheduledGame(
        label="Fake", puzzle=object, session=object, prepare=prepare
    )
    db = FakeDb([FakePuzzle(9)])

    await service.approve(db, 9, reviewer_id=None)
    await service.move(db, 9, TODAY + timedelta(days=1), reviewer_id=None)

    assert prepared == [9]
