"""Career labels, rankings, and profile mapping survive the service split."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.services.driver_attribute_service import DriverAttributeService
from app.services.driver_fact_common import FactCandidate
from app.services.driver_highlight_service import DriverHighlightService
from app.services.driver_identity_service import DriverIdentityService


def highlight_db(rows, aggregates, championships=0):
    return SimpleNamespace(
        execute=AsyncMock(
            side_effect=[Mock(all=lambda: rows), Mock(all=lambda: aggregates)]
        ),
        scalar=AsyncMock(return_value=championships),
    )


@pytest.mark.parametrize("include_sprint,race", [(False, "Grand Prix"), (True, "Race")])
async def test_career_highlights_keep_labels_rankings_and_session_scope(
    include_sprint, race
):
    rows = [
        SimpleNamespace(
            position=position,
            grid_position=grid,
            event_name="Test Grand Prix",
            year=2020,
            constructor_id=1,
            name="Test Team",
        )
        for position, grid in [(1, 1), (2, 3), (1, 4)]
    ]
    aggregates = [
        SimpleNamespace(driver_id=1, wins=2, podiums=3, poles=1, starts=3),
        SimpleNamespace(driver_id=2, wins=4, podiums=3, poles=2, starts=4),
    ]
    db = highlight_db(rows, aggregates, championships=1)
    highlights = await DriverHighlightService.highlights(
        db, SimpleNamespace(driver_id=1, constructor_ids={1}), include_sprint
    )
    by_id = {item.id: item for item in highlights}
    assert by_id["championships"].value == "1×"
    assert by_id["wins"].label == f"{race} wins"
    assert by_id["wins"].value == "2" and by_id["wins"].sublabel == "#2 all-time"
    assert by_id["podiums"].label == "Podium finishes"
    assert by_id["podiums"].sublabel == "all-time leader"
    assert by_id["poles"].label == "Start from P1"
    assert by_id["circuit_wins"].label == f"{race} wins at Test Grand Prix"
    assert by_id["podium_streak"].value == "3"
    for call in db.execute.await_args_list:
        params = call.args[0].compile().params.values()
        assert (["race", "sprint_race"] if include_sprint else ["race"]) in params


async def test_far_down_the_rankings_and_singular_totals_keep_their_labels():
    rows = [
        SimpleNamespace(
            position=1,
            grid_position=1,
            event_name="Test Grand Prix",
            year=2020,
            constructor_id=1,
            name="Test Team",
        )
    ]
    aggregates = [
        SimpleNamespace(driver_id=i, wins=2, podiums=2, poles=2, starts=2)
        for i in range(50)
    ]
    highlights = await DriverHighlightService.highlights(
        highlight_db(rows, aggregates),
        SimpleNamespace(driver_id=100, constructor_ids={1}),
    )
    assert [(item.label, item.value, item.sublabel) for item in highlights] == [
        ("Grand Prix win", "1", None),
        ("Podium finish", "1", None),
        ("Start from P1", "1", None),
        ("Grand Prix start", "1", None),
    ]


async def test_profile_maps_highlights_without_changing_public_fields(monkeypatch):
    driver = SimpleNamespace(id=1, driver_code="TST")
    attributes = SimpleNamespace(driver_id=1)
    monkeypatch.setattr(
        DriverIdentityService, "resolve", AsyncMock(return_value=driver)
    )
    monkeypatch.setattr(
        DriverAttributeService, "derive", AsyncMock(return_value={1: attributes})
    )
    highlights = AsyncMock(
        return_value=[
            FactCandidate(
                "wins", "career", "", 60, "2", "Grand Prix wins", "#3 all-time"
            )
        ]
    )
    monkeypatch.setattr(DriverHighlightService, "highlights", highlights)
    db = Mock()
    profile = await DriverHighlightService.driver_page_superlatives(
        db, "test-driver", False
    )
    assert profile.model_dump() == {
        "driver_code": "TST",
        "superlatives": [
            {
                "id": "wins",
                "value": "2",
                "label": "Grand Prix wins",
                "category": "career",
                "sublabel": "#3 all-time",
            }
        ],
    }
    highlights.assert_awaited_once_with(db, attributes, include_sprint=False)


async def test_profile_handles_missing_identity_and_incomplete_attributes(monkeypatch):
    resolve = AsyncMock(return_value=None)
    monkeypatch.setattr(DriverIdentityService, "resolve", resolve)
    assert (
        await DriverHighlightService.driver_page_superlatives(Mock(), "missing") is None
    )
    resolve.return_value = SimpleNamespace(id=1, driver_code="TST")
    monkeypatch.setattr(DriverAttributeService, "derive", AsyncMock(return_value={}))
    profile = await DriverHighlightService.driver_page_superlatives(
        Mock(), "incomplete"
    )
    assert profile.driver_code == "TST" and profile.superlatives == []
