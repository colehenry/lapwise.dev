"""Daily grid API and immutable answer snapshot tests.

Board invariants are asserted against whatever boards the configured database
holds, not against named fixtures. Boards are generated and approved now rather
than hand-authored into files, so a test naming `grid-001` and its cells would
assert the properties of one retired board rather than the rules every board
must satisfy.
"""

from datetime import date, datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.config import settings
from app.models import Driver, Puzzle
from app.models.game import BOARD_CELLS
from app.services.daily_grid_service import PUZZLE_ROLLOVER_UTC_HOUR, _puzzle_date

OPTIONS_PER_CELL = 8
PRIMARY_KINDS = {"constructor", "nationality", "race_decade"}


def api_headers() -> dict[str, str]:
    return {"X-API-Key": settings.lapwise_api_key}


def _board(row) -> dict:
    """A stored row in the authoring shape the assertions below read."""
    return {
        "id": row.public_id,
        "number": row.number,
        "rows": row.row_categories,
        "columns": row.column_categories,
        "answers": row.answers,
        "rookie_options": row.rookie_options,
        "rookie_evidence": row.rookie_evidence,
    }


@pytest_asyncio.fixture
async def boards(db_session):
    """Every stored board. Skips when the database holds none."""
    rows = (
        await db_session.execute(
            select(
                Puzzle.number,
                Puzzle.public_id,
                Puzzle.row_categories,
                Puzzle.column_categories,
                Puzzle.answers,
                Puzzle.rookie_options,
                Puzzle.rookie_evidence,
            ).order_by(Puzzle.number)
        )
    ).all()
    if not rows:
        pytest.skip("no boards in the configured database")
    return [_board(row) for row in rows]


@pytest_asyncio.fixture
async def rookie_boards(boards):
    """Boards carrying frozen option lists. Rookie Mode is offered only on
    these, so a board without them is skipped rather than failed."""
    frozen = [board for board in boards if board["rookie_options"]]
    if not frozen:
        pytest.skip("no boards carry frozen rookie options")
    return frozen


def test_every_board_has_one_answer_set_per_cell_and_safe_depth(boards):
    for board in boards:
        assert len(board["answers"]) == BOARD_CELLS
        # Two-answer cells are legal under the recognition gates the validator
        # enforces at authoring time, so the floor here is the absolute one.
        assert min(len(answers) for answers in board["answers"].values()) >= 2


def test_every_board_carries_a_secondary_category(boards):
    """Constructor, nationality and decade alone make a board of recall."""
    for board in boards:
        categories = board["rows"] + board["columns"]
        predicate_kinds = {category["predicate"]["kind"] for category in categories}
        assert predicate_kinds - PRIMARY_KINDS
        assert "car_number" not in predicate_kinds


def test_no_board_repeats_an_answer_set_across_its_own_cells(boards):
    for board in boards:
        answer_sets = {tuple(sorted(answers)) for answers in board["answers"].values()}
        assert len(answer_sets) == BOARD_CELLS


def test_rookie_option_lists_are_uniform_and_solvable(rookie_boards):
    """Every list is the same length, so size never signals cell depth, and
    every cell keeps at least one correct option."""
    for board in rookie_boards:
        options = board["rookie_options"]

        assert len(options) == BOARD_CELLS
        for cell_id, cell_options in options.items():
            assert len(cell_options) == OPTIONS_PER_CELL
            assert len(set(cell_options)) == OPTIONS_PER_CELL
            assert set(cell_options) & set(board["answers"][cell_id])


def test_rookie_correct_options_are_disjoint_across_cells(rookie_boards):
    """A correct placement must never consume the only listed answer for
    another cell, because a driver may be used once per board."""
    for board in rookie_boards:
        claimed: set[str] = set()
        for cell_id, cell_options in board["rookie_options"].items():
            correct = set(cell_options) & set(board["answers"][cell_id])
            assert not correct & claimed
            claimed.update(correct)


def test_every_rookie_decoy_fails_exactly_one_header(rookie_boards):
    """Satisfying both headers makes a driver correct by definition, so a decoy
    can only ever be wrong on one axis."""
    for board in rookie_boards:
        evidence = board["rookie_evidence"]
        for row in board["rows"]:
            for column in board["columns"]:
                cell_id = f"{row['id']}__{column['id']}"
                answers = set(board["answers"][cell_id])
                for slug in board["rookie_options"][cell_id]:
                    row_proof = evidence[f"{slug}__{row['id']}"]
                    column_proof = evidence[f"{slug}__{column['id']}"]
                    satisfies_both = (
                        row_proof["satisfied"] and column_proof["satisfied"]
                    )
                    assert satisfies_both is (slug in answers)
                    if slug not in answers:
                        assert row_proof["satisfied"] or column_proof["satisfied"]


def test_evidence_covers_every_answer_so_placements_can_be_proved(rookie_boards):
    for board in rookie_boards:
        categories = board["rows"] + board["columns"]
        for answers in board["answers"].values():
            for slug in answers:
                for category in categories:
                    assert f"{slug}__{category['id']}" in board["rookie_evidence"]


async def test_every_board_answer_resolves_to_a_driver(boards, db_session):
    expected = {
        slug
        for board in boards
        for answers in board["answers"].values()
        for slug in answers
    }
    resolved = set(
        await db_session.scalars(select(Driver.slug).where(Driver.slug.in_(expected)))
    )

    assert resolved == expected


async def test_every_answer_sits_inside_the_board_eligibility_floor(db_session):
    """A board must not accept a driver its own floor excludes.

    The five sandbox boards were authored with no floor and stored claiming
    1990, so they accepted Fangio and Moss on a board labelled 1990. Nothing
    caught it because the floor was only ever checked against a CLI default.
    """
    from app.models import Session as RaceSession
    from app.models import SessionResult

    rows = (
        await db_session.execute(
            select(Puzzle.public_id, Puzzle.eligibility_floor, Puzzle.answers)
        )
    ).all()
    if not rows:
        pytest.skip("no boards in the configured database")

    for row in rows:
        slugs = {slug for answers in row.answers.values() for slug in answers}
        eligible = set(
            await db_session.scalars(
                select(Driver.slug)
                .join(SessionResult, SessionResult.driver_id == Driver.id)
                .join(RaceSession, RaceSession.id == SessionResult.session_id)
                .where(
                    Driver.slug.in_(slugs),
                    RaceSession.session_type == "race",
                    RaceSession.year >= row.eligibility_floor,
                )
                .distinct()
            )
        )
        assert slugs == eligible, (
            f"{row.public_id} accepts drivers outside its own"
            f" {row.eligibility_floor} floor: {sorted(slugs - eligible)}"
        )


async def test_rookie_options_endpoint_withholds_evidence(
    client, published_boards, rookie_boards
):
    """Proof attached to an unplayed option is the answer, so the option list
    carries drivers only."""
    number = rookie_boards[0]["number"]
    response = await client.get(
        f"/api/daily/{number}/rookie-options", headers=api_headers()
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["options"]) == BOARD_CELLS
    for cell_options in payload["options"].values():
        assert len(cell_options) == OPTIONS_PER_CELL
        for option in cell_options:
            assert "evidence" not in option
            assert "satisfied" not in option


async def test_guess_returns_evidence_for_both_headers(
    client, published_boards, rookie_boards
):
    board = rookie_boards[0]
    row = board["rows"][0]
    column = board["columns"][0]
    slug = board["answers"][f"{row['id']}__{column['id']}"][0]

    response = await client.post(
        "/api/daily/guess",
        headers=api_headers(),
        json={
            "puzzle_id": board["id"],
            "row_id": row["id"],
            "column_id": column["id"],
            "driver_slug": slug,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["correct"] is True
    assert payload["row_evidence"]["satisfied"] is True
    assert payload["column_evidence"]["satisfied"] is True


async def test_served_board_is_never_future_dated(client, published_boards):
    """A scheduled board is not a live board, so the editorial queue can run
    ahead of the calendar without exposing tomorrow's grid."""
    response = await client.get("/api/daily", headers=api_headers())

    assert response.status_code == 200
    published_on = date.fromisoformat(response.json()["published_on"])
    assert published_on <= _puzzle_date()


def test_rollover_hour_shifts_the_playable_date():
    """The board turns over on a fixed UTC hour, not at UTC midnight, so the
    date in play trails the UTC date until that hour has passed."""
    utc_now = datetime.now(timezone.utc)
    expected = (utc_now - timedelta(hours=PUZZLE_ROLLOVER_UTC_HOUR)).date()

    assert _puzzle_date() == expected
    if utc_now.hour < PUZZLE_ROLLOVER_UTC_HOUR:
        assert _puzzle_date() == utc_now.date() - timedelta(days=1)
    else:
        assert _puzzle_date() == utc_now.date()


async def test_daily_puzzle_does_not_expose_answers(client, published_boards):
    response = await client.get("/api/daily", headers=api_headers())

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["rows"]) == 3
    assert len(payload["columns"]) == 3
    assert payload["max_guesses"] == 12
    assert "answers" not in payload
    assert all("predicate" not in category for category in payload["rows"])
    assert payload["next_number"] is None


async def test_archive_navigation_walks_the_published_set(client, published_boards):
    """Previous and next come from the published set, so a gap in the numbering
    cannot produce a link to a board that will not load."""
    response = await client.get("/api/daily", headers=api_headers())
    assert response.status_code == 200
    latest = response.json()

    previous_number = latest["previous_number"]
    if previous_number is None:
        pytest.skip("only one published board")

    response = await client.get(f"/api/daily/{previous_number}", headers=api_headers())
    assert response.status_code == 200
    assert response.json()["next_number"] == latest["number"]
    assert "answers" not in response.json()


async def test_driver_search_uses_canonical_driver_records(client, ingested_data):
    response = await client.get("/api/daily/drivers?q=Lewis", headers=api_headers())

    assert response.status_code == 200
    drivers = response.json()["drivers"]
    assert any(driver["driver_slug"] == "hamilton" for driver in drivers)
    assert all("headshot_url" in driver for driver in drivers)


async def test_driver_catalog_exposes_precomputed_race_entries(client, ingested_data):
    response = await client.get("/api/daily/drivers/catalog", headers=api_headers())

    assert response.status_code == 200
    drivers = response.json()["drivers"]
    assert len(drivers) > 100
    assert all(driver["race_entries"] > 0 for driver in drivers)
    assert any(driver["driver_slug"] == "hamilton" for driver in drivers)


async def test_partial_driver_search_prioritizes_career_race_entries(
    client, ingested_data
):
    verstappen = await client.get("/api/daily/drivers?q=vers", headers=api_headers())
    lewis = await client.get("/api/daily/drivers?q=lew", headers=api_headers())

    assert verstappen.status_code == 200
    assert verstappen.json()["drivers"][0]["driver_slug"] == "max-verstappen"
    assert lewis.status_code == 200
    assert lewis.json()["drivers"][0]["driver_slug"] == "hamilton"


async def test_correct_guess_is_validated_against_snapshot(
    client, published_boards, boards
):
    board = boards[0]
    row = board["rows"][0]
    column = board["columns"][0]
    slug = board["answers"][f"{row['id']}__{column['id']}"][0]

    response = await client.post(
        "/api/daily/guess",
        headers=api_headers(),
        json={
            "puzzle_id": board["id"],
            "row_id": row["id"],
            "column_id": column["id"],
            "driver_slug": slug,
        },
    )

    assert response.status_code == 200
    assert response.json()["correct"] is True


async def test_incorrect_guess_still_returns_selected_driver(
    client, published_boards, boards
):
    board = boards[0]
    row = board["rows"][0]
    column = board["columns"][0]
    answers = set(board["answers"][f"{row['id']}__{column['id']}"])
    wrong = next(
        slug
        for cell_id, cell in board["answers"].items()
        for slug in cell
        if slug not in answers
    )

    response = await client.post(
        "/api/daily/guess",
        headers=api_headers(),
        json={
            "puzzle_id": board["id"],
            "row_id": row["id"],
            "column_id": column["id"],
            "driver_slug": wrong,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["correct"] is False
    assert payload["driver"]["driver_slug"] == wrong


async def test_unknown_cell_is_rejected(client, published_boards, boards):
    board = boards[0]

    response = await client.post(
        "/api/daily/guess",
        headers=api_headers(),
        json={
            "puzzle_id": board["id"],
            "row_id": board["rows"][0]["id"],
            "column_id": "not-a-category",
            "driver_slug": "hamilton",
        },
    )

    assert response.status_code == 400
