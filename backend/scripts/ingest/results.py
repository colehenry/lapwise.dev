
from sqlalchemy import select
from app.models import SessionResult
from .utils import timedelta_to_seconds, safe_int, safe_float
from .participants import ingest_driver, ingest_team
from sqlalchemy.orm import Session as SQLAlchemySession

def ingest_race_results(db: SQLAlchemySession, fastf1_session, session_id, year):
    """
    Ingest race or sprint race results.

    Args:
        db: Database session
        fastf1_session: FastF1 session object (already loaded)
        session_id: ID of the session in our database
        year: Season year
    """
    results = fastf1_session.results
    print(f"  📊 Processing {len(results)} driver results...")

    # Get fastest lap info from laps data (only available for 2018+)
    fastest_lap_driver = None
    if year >= 2018:
        try:
            laps = fastf1_session.laps
            if laps is not None and len(laps) > 0:
                fastest_lap = laps.pick_fastest()
                fastest_lap_driver = fastest_lap["Driver"] if fastest_lap is not None else None
        except Exception as e:
            print(f"    ⚠️  Could not determine fastest lap: {e}")
    else:
        print(f"    ℹ️  Fastest lap data not available for pre-2018 seasons")

    new_results = 0
    for idx, driver_result in results.iterrows():
        # Get or create driver
        driver_id = ingest_driver(db, driver_result)

        # Get or create team (year-specific)
        team_id = ingest_team(db, driver_result, year)

        # Check if result already exists
        existing_result = db.execute(
            select(SessionResult).where(
                SessionResult.session_id == session_id,
                SessionResult.driver_id == driver_id,
            )
        ).scalar_one_or_none()

        if existing_result:
            continue  # Skip existing result

        # Create new result
        new_results += 1

        # Check if this driver had the fastest lap
        driver_code = driver_result["Abbreviation"]
        had_fastest_lap = (
            (fastest_lap_driver == driver_code) if fastest_lap_driver else False
        )

        # Convert time to seconds
        time_seconds = timedelta_to_seconds(driver_result.get("Time"))

        result = SessionResult(
            session_id=session_id,
            driver_id=driver_id,
            team_id=team_id,
            position=safe_int(driver_result.get("Position")),
            status=str(driver_result.get("Status", "Unknown")),
            headshot_url=driver_result.get("HeadshotUrl"),
            grid_position=safe_int(driver_result.get("GridPosition")),
            points=safe_float(driver_result.get("Points")),
            laps_completed=safe_int(
                driver_result.get("Laps")
            ),  # Available in FastF1 3.6+
            time_seconds=time_seconds,
            fastest_lap=had_fastest_lap,
        )
        db.add(result)

    db.commit()
    print(f"  ✓ Added {new_results} new results")


def ingest_qualifying_results(db: SQLAlchemySession, fastf1_session, session_id, year):
    """
    Ingest qualifying or sprint qualifying results.

    Args:
        db: Database session
        fastf1_session: FastF1 session object (already loaded)
        session_id: ID of the session in our database
        year: Season year
    """
    results = fastf1_session.results
    print(f"  📊 Processing {len(results)} qualifying results...")

    new_results = 0
    for idx, driver_result in results.iterrows():
        # Get or create driver
        driver_id = ingest_driver(db, driver_result)

        # Get or create team (year-specific)
        team_id = ingest_team(db, driver_result, year)

        # Check if result already exists
        existing_result = db.execute(
            select(SessionResult).where(
                SessionResult.session_id == session_id,
                SessionResult.driver_id == driver_id,
            )
        ).scalar_one_or_none()

        if existing_result:
            continue

        new_results += 1

        # Convert qualifying times to seconds
        q1_time = timedelta_to_seconds(driver_result.get("Q1"))
        q2_time = timedelta_to_seconds(driver_result.get("Q2"))
        q3_time = timedelta_to_seconds(driver_result.get("Q3"))

        result = SessionResult(
            session_id=session_id,
            driver_id=driver_id,
            team_id=team_id,
            position=safe_int(driver_result.get("Position")),
            status=str(driver_result.get("Status", "Unknown")),
            headshot_url=driver_result.get("HeadshotUrl"),
            q1_time_seconds=q1_time,
            q2_time_seconds=q2_time,
            q3_time_seconds=q3_time,
        )
        db.add(result)

    db.commit()
    print(f"  ✓ Added {new_results} new qualifying results")
