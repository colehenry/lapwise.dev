"""Daily grid API and immutable answer snapshot tests."""

from sqlalchemy import select

from app.config import settings
from app.models import Driver
from app.services.game_service import _puzzle


def api_headers() -> dict[str, str]:
    return {"X-API-Key": settings.lapwise_api_key}


def test_snapshot_has_one_answer_set_per_cell_and_safe_depth():
    puzzle = _puzzle()

    assert len(puzzle["answers"]) == 9
    assert min(len(answers) for answers in puzzle["answers"].values()) >= 3


async def test_every_snapshot_driver_resolves(ingested_data):
    expected = {slug for answers in _puzzle()["answers"].values() for slug in answers}
    resolved = set(
        await ingested_data.scalars(
            select(Driver.slug).where(Driver.slug.in_(expected))
        )
    )

    assert resolved == expected


async def test_daily_puzzle_does_not_expose_answers(client):
    response = await client.get("/api/game/daily", headers=api_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "grid-001"
    assert len(payload["rows"]) == 3
    assert len(payload["columns"]) == 3
    assert "answers" not in payload
    assert all("predicate" not in category for category in payload["rows"])


async def test_driver_search_uses_canonical_driver_records(client, ingested_data):
    response = await client.get("/api/game/drivers?q=Lewis", headers=api_headers())

    assert response.status_code == 200
    drivers = response.json()["drivers"]
    assert any(driver["driver_slug"] == "hamilton" for driver in drivers)
    assert all(driver["country_code"] for driver in drivers)


async def test_correct_guess_is_validated_against_snapshot(client, ingested_data):
    response = await client.post(
        "/api/game/daily/guess",
        headers=api_headers(),
        json={
            "row_id": "constructor-ferrari",
            "column_id": "constructor-mclaren",
            "driver_slug": "hamilton",
        },
    )

    assert response.status_code == 200
    assert response.json()["correct"] is True


async def test_incorrect_guess_still_returns_selected_driver(client, ingested_data):
    response = await client.post(
        "/api/game/daily/guess",
        headers=api_headers(),
        json={
            "row_id": "constructor-ferrari",
            "column_id": "constructor-mclaren",
            "driver_slug": "max-verstappen",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["correct"] is False
    assert payload["driver"]["full_name"] == "Max Verstappen"


async def test_unknown_cell_is_rejected(client, ingested_data):
    response = await client.post(
        "/api/game/daily/guess",
        headers=api_headers(),
        json={
            "row_id": "constructor-ferrari",
            "column_id": "not-a-category",
            "driver_slug": "hamilton",
        },
    )

    assert response.status_code == 400
