"""The next race rolls over at lights out, not at midnight on race day."""

from datetime import datetime, timezone

import pandas as pd

from app.services.event_service import EventService


def weekend(name, race_day, race_start=None, round_number=1):
    row = {
        "RoundNumber": round_number,
        "EventName": name,
        "EventDate": pd.Timestamp(race_day),
        "Session5": "Race" if race_start else "Practice 3",
        "Session5DateUtc": pd.Timestamp(race_start) if race_start else pd.NaT,
    }
    for slot in range(1, 5):
        row[f"Session{slot}"] = "Practice 1"
        row[f"Session{slot}DateUtc"] = pd.NaT
    return row


def test_race_day_before_lights_out_is_still_upcoming():
    schedule = pd.DataFrame(
        [
            weekend("Spanish Grand Prix", "2026-09-13", "2026-09-13 13:00:00"),
            weekend("Azerbaijan Grand Prix", "2026-09-26", "2026-09-26 11:00:00"),
        ]
    )

    upcoming = EventService._still_to_run(
        schedule, datetime(2026, 9, 13, 9, 0, tzinfo=timezone.utc)
    )

    assert list(upcoming["EventName"]) == [
        "Spanish Grand Prix",
        "Azerbaijan Grand Prix",
    ]


def test_race_day_after_lights_out_rolls_to_the_next_round():
    schedule = pd.DataFrame(
        [
            weekend("Spanish Grand Prix", "2026-09-13", "2026-09-13 13:00:00"),
            weekend("Azerbaijan Grand Prix", "2026-09-26", "2026-09-26 11:00:00"),
        ]
    )

    upcoming = EventService._still_to_run(
        schedule, datetime(2026, 9, 13, 13, 0, 1, tzinfo=timezone.utc)
    )

    assert list(upcoming["EventName"]) == ["Azerbaijan Grand Prix"]


def test_testing_weekend_stays_until_its_last_day_has_passed():
    schedule = pd.DataFrame(
        [weekend("Pre-Season Testing", "2026-01-28", round_number=0)]
    )

    on_the_day = EventService._still_to_run(
        schedule, datetime(2026, 1, 28, 23, 0, tzinfo=timezone.utc)
    )
    day_after = EventService._still_to_run(
        schedule, datetime(2026, 1, 29, 0, 0, tzinfo=timezone.utc)
    )

    assert len(on_the_day) == 1
    assert day_after.empty


def test_empty_schedule_is_left_alone():
    assert EventService._still_to_run(
        pd.DataFrame(columns=["EventDate"]), datetime.now(timezone.utc)
    ).empty
