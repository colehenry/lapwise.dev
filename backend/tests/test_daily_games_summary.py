"""The Daily Games summary reports each board's progress, not just a state."""

from datetime import date
from types import SimpleNamespace

from app.services.daily_games_service import DailyGamesService


class QueuedDb:
    """Answers `scalar` calls in order: grid puzzle, guess puzzle, then sessions."""

    def __init__(self, *rows):
        self.rows = list(rows)

    async def scalar(self, _statement):
        return self.rows.pop(0)


def puzzle(number, max_guesses=None):
    row = SimpleNamespace(id=number, number=number, published_on=date(2026, 9, 10))
    if max_guesses is not None:
        row.max_guesses = max_guesses
    return row


async def test_progress_counts_solved_cells_and_used_guesses():
    db = QueuedDb(
        puzzle(41),
        puzzle(12, max_guesses=8),
        SimpleNamespace(cells_solved=4, misses=2, finished_at=None),
        SimpleNamespace(guesses_used=3, finished_at=None),
    )

    grid, guess = (await DailyGamesService.summary(db, None, "anon")).games

    assert (grid.state, grid.progress, grid.total) == ("in_progress", 4, 9)
    assert (guess.state, guess.progress, guess.total) == ("in_progress", 3, 8)
    assert guess.name == "Guess the Driver"


async def test_unplayed_boards_start_at_zero():
    db = QueuedDb(puzzle(41), puzzle(12, max_guesses=10), None, None)

    grid, guess = (await DailyGamesService.summary(db, None, "anon")).games

    assert (grid.state, grid.progress, grid.total) == ("not_started", 0, 9)
    assert (guess.state, guess.progress, guess.total) == ("not_started", 0, 10)


async def test_no_published_puzzle_still_reports_a_board_size():
    grid, guess = (
        await DailyGamesService.summary(QueuedDb(None, None), None, None)
    ).games

    assert (grid.puzzle_number, grid.total) == (None, 9)
    assert (guess.puzzle_number, guess.total) == (None, 10)
