"""
Practice Session Results Ingestion Module

Ingests FP1/FP2/FP3 results: position, status, and best lap time only.
Derives positions from best lap times since FastF1 doesn't populate
Position/Time fields for practice sessions.
"""

import pandas as pd
from sqlalchemy import select
from app.models import SessionResult
from .utils import timedelta_to_seconds, safe_int
from .participants import ingest_driver, ingest_team
from sqlalchemy.orm import Session as SQLAlchemySession


def ingest_practice_results(db: SQLAlchemySession, fastf1_session, session_id, year):
    """
    Ingest practice session results (FP1/FP2/FP3).

    Derives position and best lap time from laps data, since FastF1's
    results DataFrame has NaN for Position/Time in practice sessions.
    """
    results = fastf1_session.results
    print(f"  📊 Processing {len(results)} practice results...")

    # Build best lap times from laps data to derive positions
    best_laps = {}
    try:
        laps = fastf1_session.laps
        if laps is not None and not laps.empty:
            grouped = laps.groupby("DriverNumber")["LapTime"].min().dropna()
            # Sort by best time to assign positions
            sorted_times = grouped.sort_values()
            for pos, (driver_num, lap_time) in enumerate(sorted_times.items(), 1):
                best_laps[str(driver_num)] = {
                    "position": pos,
                    "time_seconds": lap_time.total_seconds(),
                }
    except Exception as e:
        print(f"  ⚠️  Could not derive positions from laps: {e}")

    new_results = 0
    for idx, driver_result in results.iterrows():
        driver_id = ingest_driver(db, driver_result)
        team_id = ingest_team(db, driver_result, year)

        existing_result = db.execute(
            select(SessionResult).where(
                SessionResult.session_id == session_id,
                SessionResult.driver_id == driver_id,
            )
        ).scalar_one_or_none()

        if existing_result:
            continue

        new_results += 1

        driver_num = str(driver_result.get("DriverNumber", ""))
        lap_info = best_laps.get(driver_num, {})

        # Use derived position/time from laps, fall back to results DataFrame
        position = lap_info.get("position") or safe_int(
            driver_result.get("Position")
        )
        time_seconds = lap_info.get("time_seconds") or timedelta_to_seconds(
            driver_result.get("Time")
        )

        # Drivers without a lap time get positioned after those with times
        if position is None and best_laps:
            position = len(best_laps) + 1

        result = SessionResult(
            session_id=session_id,
            driver_id=driver_id,
            team_id=team_id,
            position=position,
            status=str(driver_result.get("Status", "") or ""),
            headshot_url=driver_result.get("HeadshotUrl"),
            time_seconds=time_seconds,
        )
        db.add(result)

    db.commit()
    print(f"  ✓ Added {new_results} new practice results")
