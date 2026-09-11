"""The one UTC rollover shared by both Daily Games."""

from datetime import date, datetime, timedelta, timezone

PUZZLE_ROLLOVER_UTC_HOUR = 7


def puzzle_date() -> date:
    return (
        datetime.now(timezone.utc) - timedelta(hours=PUZZLE_ROLLOVER_UTC_HOUR)
    ).date()
