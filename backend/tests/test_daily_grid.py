"""Daily grid API and immutable answer snapshot tests."""

from sqlalchemy import select

from app.config import settings
from app.models import Driver
from app.services.daily_grid_service import _puzzle


def api_headers() -> dict[str, str]:
    return {"X-API-Key": settings.lapwise_api_key}


def test_snapshot_has_one_answer_set_per_cell_and_safe_depth():
    for number in range(1, 6):
        puzzle = _puzzle(number)
        assert len(puzzle["answers"]) == 9
        assert min(len(answers) for answers in puzzle["answers"].values()) >= 3


def test_sandbox_boards_vary_structure_and_include_secondary_categories():
    puzzles = [_puzzle(number) for number in range(1, 6)]
    primary_kinds = {"constructor", "nationality", "race_decade"}

    for puzzle in puzzles:
        categories = puzzle["rows"] + puzzle["columns"]
        predicate_kinds = {category["predicate"]["kind"] for category in categories}
        assert predicate_kinds - primary_kinds
        assert "car_number" not in predicate_kinds
        answer_sets = {tuple(sorted(answers)) for answers in puzzle["answers"].values()}
        assert len(answer_sets) == 9

    assert any(
        category["predicate"]["kind"] == "constructor"
        for puzzle in puzzles
        for category in puzzle["rows"]
    )
    assert any(
        category["predicate"]["kind"] == "constructor"
        for puzzle in puzzles
        for category in puzzle["columns"]
    )


def test_rookie_option_lists_are_uniform_and_solvable():
    """Every list is the same length, so size never signals cell depth, and
    every cell keeps at least one correct option."""
    for number in range(1, 6):
        puzzle = _puzzle(number)
        options = puzzle["rookie_options"]

        assert len(options) == 9
        for cell_id, cell_options in options.items():
            assert len(cell_options) == 8
            assert len(set(cell_options)) == 8
            assert set(cell_options) & set(puzzle["answers"][cell_id])


def test_rookie_correct_options_are_disjoint_across_cells():
    """A correct placement must never consume the only listed answer for
    another cell, because a driver may be used once per board."""
    for number in range(1, 6):
        puzzle = _puzzle(number)
        claimed: set[str] = set()
        for cell_id, cell_options in puzzle["rookie_options"].items():
            correct = set(cell_options) & set(puzzle["answers"][cell_id])
            assert not correct & claimed
            claimed.update(correct)


def test_every_rookie_decoy_fails_exactly_one_header():
    """Satisfying both headers makes a driver correct by definition, so a decoy
    can only ever be wrong on one axis."""
    for number in range(1, 6):
        puzzle = _puzzle(number)
        evidence = puzzle["rookie_evidence"]
        for row in puzzle["rows"]:
            for column in puzzle["columns"]:
                cell_id = f"{row['id']}__{column['id']}"
                answers = set(puzzle["answers"][cell_id])
                for slug in puzzle["rookie_options"][cell_id]:
                    row_proof = evidence[f"{slug}__{row['id']}"]
                    column_proof = evidence[f"{slug}__{column['id']}"]
                    satisfies_both = row_proof["satisfied"] and column_proof["satisfied"]
                    assert satisfies_both is (slug in answers)
                    if slug not in answers:
                        assert row_proof["satisfied"] or column_proof["satisfied"]


def test_evidence_covers_every_answer_so_placements_can_be_proved():
    for number in range(1, 6):
        puzzle = _puzzle(number)
        categories = puzzle["rows"] + puzzle["columns"]
        for answers in puzzle["answers"].values():
            for slug in answers:
                for category in categories:
                    assert f"{slug}__{category['id']}" in puzzle["rookie_evidence"]


async def test_rookie_options_endpoint_withholds_evidence(client, ingested_data):
    """Proof attached to an unplayed option is the answer, so the option list
    carries drivers only."""
    response = await client.get("/api/daily/1/rookie-options", headers=api_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["puzzle_id"] == "grid-001"
    assert len(payload["options"]) == 9
    for cell_options in payload["options"].values():
        assert len(cell_options) == 8
        for option in cell_options:
            assert "evidence" not in option
            assert "satisfied" not in option


async def test_guess_returns_evidence_for_both_headers(client, ingested_data):
    puzzle = _puzzle(1)
    row = puzzle["rows"][0]
    column = puzzle["columns"][0]
    slug = puzzle["answers"][f"{row['id']}__{column['id']}"][0]

    response = await client.post(
        "/api/daily/guess",
        headers=api_headers(),
        json={
            "puzzle_id": "grid-001",
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


async def test_every_snapshot_driver_resolves(ingested_data):
    expected = {
        slug
        for number in range(1, 6)
        for answers in _puzzle(number)["answers"].values()
        for slug in answers
    }
    resolved = set(
        await ingested_data.scalars(
            select(Driver.slug).where(Driver.slug.in_(expected))
        )
    )

    assert resolved == expected


async def test_daily_puzzle_does_not_expose_answers(client):
    response = await client.get("/api/daily", headers=api_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "grid-005"
    assert len(payload["rows"]) == 3
    assert len(payload["columns"]) == 3
    assert payload["max_guesses"] == 12
    assert "answers" not in payload
    assert all("predicate" not in category for category in payload["rows"])
    assert payload["rows"][0]["visual"] == {
        "kind": "text",
        "value": "Teammate of Verstappen",
    }
    assert payload["previous_number"] == 4
    assert payload["next_number"] is None


async def test_numbered_puzzle_exposes_navigation_not_answers(client):
    response = await client.get("/api/daily/1", headers=api_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "grid-001"
    assert payload["previous_number"] is None
    assert payload["next_number"] == 2
    assert "answers" not in payload


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


async def test_correct_guess_is_validated_against_snapshot(client, ingested_data):
    response = await client.post(
        "/api/daily/guess",
        headers=api_headers(),
        json={
            "puzzle_id": "grid-001",
            "row_id": "constructor-ferrari",
            "column_id": "constructor-mclaren",
            "driver_slug": "hamilton",
        },
    )

    assert response.status_code == 200
    assert response.json()["correct"] is True


async def test_incorrect_guess_still_returns_selected_driver(client, ingested_data):
    response = await client.post(
        "/api/daily/guess",
        headers=api_headers(),
        json={
            "puzzle_id": "grid-001",
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
        "/api/daily/guess",
        headers=api_headers(),
        json={
            "puzzle_id": "grid-001",
            "row_id": "constructor-ferrari",
            "column_id": "not-a-category",
            "driver_slug": "hamilton",
        },
    )

    assert response.status_code == 400
