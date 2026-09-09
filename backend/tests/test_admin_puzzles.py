"""Editorial queue behaviour.

The queue exists so a human reads the answers before a board publishes, so the
tests care most about what it exposes and what it refuses.
"""

from datetime import date

import pytest
from sqlalchemy import select

from app.config import settings
from app.models import GameSession, Puzzle
from app.schemas.admin_puzzle import PuzzleScheduleRequest
from app.services.admin_puzzle_service import AdminPuzzleService


def api_headers() -> dict[str, str]:
    return {"X-API-Key": settings.lapwise_api_key}


async def _any_puzzle(db) -> Puzzle:
    puzzle = (
        await db.execute(select(Puzzle).order_by(Puzzle.number).limit(1))
    ).scalar_one_or_none()
    if puzzle is None:
        pytest.skip("no puzzles in the configured database")
    return puzzle


async def test_queue_exposes_every_answer_with_its_recognition_facts(db_session):
    """A count cannot tell a reviewer whether a cell is fair. The names and the
    numbers the gates turn on have to be readable."""
    puzzle = await _any_puzzle(db_session)
    detail = await AdminPuzzleService.detail(db_session, puzzle.number)

    assert len(detail.cells) == 9
    for cell in detail.cells:
        assert cell.depth == len(cell.answers)
        assert cell.depth == len(puzzle.answers[cell.cell_id])
        for answer in cell.answers:
            assert answer.full_name
            assert answer.entries >= 0
            assert answer.wins >= 0


async def test_answers_are_ordered_by_recognition(db_session):
    puzzle = await _any_puzzle(db_session)
    detail = await AdminPuzzleService.detail(db_session, puzzle.number)

    for cell in detail.cells:
        entries = [answer.entries for answer in cell.answers]
        assert entries == sorted(entries, reverse=True)


async def test_detail_reports_the_headers_a_reviewer_is_judging(db_session):
    puzzle = await _any_puzzle(db_session)
    detail = await AdminPuzzleService.detail(db_session, puzzle.number)

    assert len(detail.rows) == 3
    assert len(detail.columns) == 3
    row_ids = {row.id for row in detail.rows}
    column_ids = {column.id for column in detail.columns}
    for cell in detail.cells:
        assert cell.row_id in row_ids
        assert cell.column_id in column_ids
        assert cell.row_label
        assert cell.column_label


async def test_scheduling_refuses_a_date_another_board_holds(db_session):
    """One board per day. The partial unique index enforces it in the
    database; this is the readable error before that fires."""
    published = (
        await db_session.execute(
            select(Puzzle).where(Puzzle.status == "published").limit(1)
        )
    ).scalar_one_or_none()
    if published is None:
        pytest.skip("needs two published boards")
    other = (
        await db_session.execute(
            select(Puzzle)
            .where(Puzzle.status == "published", Puzzle.number != published.number)
            .limit(1)
        )
    ).scalar_one_or_none()
    if other is None:
        pytest.skip("needs two published boards")

    with pytest.raises(ValueError, match="already published on that date"):
        await AdminPuzzleService.schedule(
            db_session,
            other.number,
            PuzzleScheduleRequest(published_on=published.published_on),
            reviewer_id=None,
        )


async def test_a_played_board_cannot_be_reverted(db_session):
    """A board someone has played is a record, not a proposal."""
    played = (
        await db_session.execute(
            select(Puzzle)
            .join(GameSession, GameSession.puzzle_id == Puzzle.id)
            .limit(1)
        )
    ).scalar_one_or_none()
    if played is None:
        pytest.skip("no played boards")

    with pytest.raises(ValueError, match="cannot be reverted"):
        await AdminPuzzleService.revert(db_session, played.number)


async def test_reverting_frees_the_date(db_session, scratch_puzzle):
    """A draft holding a date reads as scheduled in the queue and blocks the
    calendar slot, so the date goes back when the status does."""
    scratch_puzzle.status = "published"
    scratch_puzzle.published_on = date(2999, 1, 1)
    await db_session.commit()

    result = await AdminPuzzleService.revert(db_session, scratch_puzzle.number)

    assert result.status == "draft"
    assert result.published_on is None


async def test_a_played_board_cannot_be_deleted(db_session):
    """Deleting a board with results behind it destroys those results."""
    played = (
        await db_session.execute(
            select(Puzzle)
            .join(GameSession, GameSession.puzzle_id == Puzzle.id)
            .limit(1)
        )
    ).scalar_one_or_none()
    if played is None:
        pytest.skip("no played boards")

    with pytest.raises(ValueError, match="cannot be deleted"):
        await AdminPuzzleService.delete(db_session, played.number)


async def test_queue_routes_require_an_admin(client):
    """Every route here returns complete answer sets, which is the opposite of
    the player contract."""
    for path in ("/api/admin/puzzles", "/api/admin/puzzles/1"):
        response = await client.get(path, headers=api_headers())
        assert response.status_code in (401, 403), path
