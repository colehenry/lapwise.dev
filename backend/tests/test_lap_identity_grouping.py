from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.services.results.laps import LapsService
from app.services.results.session_data import SessionDataService


def _lap_row(driver_id: int, full_name: str, lap_number: int):
    return SimpleNamespace(
        driver_id=driver_id,
        driver_code=None,
        jolpica_id=full_name.lower().replace(" ", "_"),
        full_name=full_name,
        country_code=None,
        team_color=None,
        final_position=driver_id,
        lap_number=lap_number,
        lap_time_seconds=90.0 + driver_id,
        compound=None,
        tyre_life=None,
        stint=None,
        track_status=None,
        sector1_time_seconds=None,
        sector2_time_seconds=None,
        sector3_time_seconds=None,
        pit_in_time_seconds=None,
        pit_out_time_seconds=None,
        position=driver_id,
        speed_st=None,
        speed_i1=None,
        speed_i2=None,
        speed_fl=None,
        fresh_tyre=None,
        is_personal_best=None,
        deleted=None,
        lap_start_time_seconds=None,
    )


@pytest.mark.asyncio
async def test_null_driver_codes_do_not_merge_historical_lap_series(monkeypatch):
    session = SimpleNamespace(id=10, event_name="Historical GP")
    session_result = Mock()
    session_result.scalar_one_or_none.return_value = session

    laps_result = Mock()
    laps_result.all.return_value = [
        _lap_row(1, "Driver One", 1),
        _lap_row(1, "Driver One", 2),
        _lap_row(2, "Driver Two", 1),
        _lap_row(2, "Driver Two", 2),
    ]

    db = SimpleNamespace(execute=AsyncMock(side_effect=[session_result, laps_result]))
    monkeypatch.setattr(
        SessionDataService, "get_track_status", AsyncMock(return_value=[])
    )
    monkeypatch.setattr(
        SessionDataService, "get_race_control_events", AsyncMock(return_value=[])
    )
    monkeypatch.setattr(LapsService, "_pit_durations", AsyncMock(return_value={}))

    response = await LapsService.get_lap_times(db, 1996, 1)

    assert response is not None
    assert [driver.full_name for driver in response.drivers] == [
        "Driver One",
        "Driver Two",
    ]
    assert [[lap.lap_number for lap in driver.laps] for driver in response.drivers] == [
        [1, 2],
        [1, 2],
    ]
