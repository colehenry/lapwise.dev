"""
Season Data Ingestion Script

Ingests session data (races, qualifying, sprints) for a given F1 season.
Safe to run multiple times (idempotent) - checks database first, skips existing data.

Requirements:
    - FastF1 3.6.1+ (calculates results from F1 Live Timing API)
    - PYTHONPATH must include backend directory

Usage:
    PYTHONPATH=$PWD python scripts/ingest_season.py
    PYTHONPATH=$PWD python scripts/ingest_season.py 2023  # Specific year
    PYTHONPATH=$PWD python scripts/ingest_season.py 2024 race,qualifying  # Specific session types
    PYTHONPATH=$PWD python scripts/ingest_season.py 2024 --strict  # Fail fast on errors

Features:
    - ⚡ Database-first approach: Checks DB before making expensive FastF1 API calls
    - Automatic retry with exponential backoff for network failures
    - Detailed error reporting and success/failure tracking
    - Absolute cache path for consistent caching
    - Session availability detection (skips non-existent sprint sessions)
    - Optional strict mode (--strict) to fail immediately on errors

Schema:
    - sessions: year, round, session_type, event_name, date, circuit_id
    - session_results: Universal fields (position, status) + session-specific fields
      * Race/Sprint: grid_position, points, time_seconds, laps_completed, fastest_lap
      * Qualifying: q1_time_seconds, q2_time_seconds, q3_time_seconds
    - teams: Year-partitioned (unique constraint on year + name)
    - drivers: Year-independent (driver_code unique)

Session Types:
    - race: Main race
    - qualifying: Qualifying session
    - sprint_race: Sprint race (not all events)
    - sprint_qualifying: Sprint qualifying (not all events)

Note:
    FastF1 3.6.1+ calculates results from live timing data since Ergast API
    shutdown in 2024. Earlier versions (3.2.0) will result in NULL values.
"""

import fastf1
import sys
import os
import time
import json
from datetime import datetime
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

# Import our models and config
from app.models import Driver, Team, Circuit, Session, SessionResult
from app.models import Lap, Weather, TrackStatus, RaceControlMessage
from app.config import settings


# Session types to ingest (configurable)
DEFAULT_SESSION_TYPES = ['race', 'qualifying', 'sprint_race', 'sprint_qualifying']


def write_failure_log(season_year, failures):
    """
    Write ingestion failures to a persistent log file.

    Args:
        season_year: Season year
        failures: List of (round, event_name, session_type, error) tuples
    """
    if not failures:
        return

    log_dir = os.path.join(os.path.dirname(__file__), "../logs")
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    log_file = os.path.join(log_dir, f"ingestion_failures_{season_year}.json")

    failure_records = []
    for round_num, event_name, session_type, error in failures:
        failure_records.append({
            "timestamp": datetime.now().isoformat(),
            "season": season_year,
            "round": round_num,
            "event_name": event_name,
            "session_type": session_type,
            "error": str(error)
        })

    # Append to existing log or create new
    existing_failures = []
    if os.path.exists(log_file):
        try:
            with open(log_file, 'r') as f:
                existing_failures = json.load(f)
        except Exception:
            pass  # If can't read, start fresh

    all_failures = existing_failures + failure_records

    with open(log_file, 'w') as f:
        json.dump(all_failures, f, indent=2)

    print(f"\n📝 Failure log written to: {log_file}")


def get_db_session():
    """Create a synchronous database session for ingestion."""
    # Convert async URL to sync URL for script usage
    database_url = settings.database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )

    # Handle SSL parameter for Neon/cloud databases
    # psycopg2 expects sslmode instead of ssl
    if "?ssl=require" in database_url:
        database_url = database_url.replace("?ssl=require", "?sslmode=require")

    engine = create_engine(database_url, echo=False)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def ingest_circuit(db, event):
    """
    Ingest circuit if it doesn't exist.

    Returns: circuit_id
    """
    circuit_name = event.get("Location")  # Circuit location (e.g., "Bahrain International Circuit")
    location = event.get("Location")
    country = event.get("Country")

    # Check if circuit exists by name
    circuit = db.execute(
        select(Circuit).where(Circuit.name == circuit_name)
    ).scalar_one_or_none()

    if circuit:
        print(f"  ✓ Circuit exists: {circuit_name}")
        return circuit.id
    else:
        print(f"  + Creating circuit: {circuit_name}")
        circuit = Circuit(
            name=circuit_name,
            location=location,
            country=country,
            track_length_km=None  # FastF1 doesn't provide this directly
        )
        db.add(circuit)
        db.commit()
        db.refresh(circuit)
        return circuit.id


def ingest_session_metadata(db, event, circuit_id, year, session_type, session_date):
    """
    Ingest session metadata if it doesn't exist.

    Returns: (session_id, should_process_results)
    """
    round_num = event["RoundNumber"]
    event_name = event["EventName"]

    # Check if session exists
    existing_session = db.execute(
        select(Session).where(
            Session.year == year,
            Session.round == round_num,
            Session.session_type == session_type
        )
    ).scalar_one_or_none()

    if existing_session:
        print(f"  ✓ Session exists: {year} R{round_num} {session_type}")
        return existing_session.id, False  # Don't process results
    else:
        print(f"  + Creating session: {year} R{round_num} {session_type} - {event_name}")
        session = Session(
            year=year,
            round=round_num,
            session_type=session_type,
            event_name=event_name,
            date=session_date.date() if hasattr(session_date, "date") else session_date,
            circuit_id=circuit_id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session.id, True  # Process results


def ingest_driver(db, driver_data):
    """
    Ingest or update driver.

    Args:
        driver_data: Row from session.results DataFrame

    Returns: driver_id
    """
    driver_code = driver_data["Abbreviation"]

    # Check if driver exists by code
    driver = db.execute(
        select(Driver).where(Driver.driver_code == driver_code)
    ).scalar_one_or_none()

    if driver:
        return driver.id
    else:
        print(f"    + New driver: {driver_data['FullName']} ({driver_code})")
        driver = Driver(
            full_name=driver_data["FullName"],
            driver_code=driver_code,
            driver_number=(
                int(driver_data["DriverNumber"])
                if driver_data["DriverNumber"]
                else None
            ),
            country_code=driver_data.get("CountryCode"),
        )
        db.add(driver)
        db.commit()
        db.refresh(driver)
        return driver.id


def ingest_team(db, team_data, year):
    """
    Ingest team for a specific year if it doesn't exist.

    Args:
        team_data: Row from session.results DataFrame
        year: Season year

    Returns: team_id
    """
    team_name = team_data["TeamName"]
    team_color = team_data.get("TeamColor", "")

    # Remove '#' from color if present
    if team_color and team_color.startswith('#'):
        team_color = team_color[1:]

    # Check if team exists for this year
    team = db.execute(
        select(Team).where(Team.year == year, Team.name == team_name)
    ).scalar_one_or_none()

    if team:
        return team.id
    else:
        print(f"    + New team for {year}: {team_name}")
        team = Team(
            year=year,
            name=team_name,
            team_color=team_color if team_color else None
        )
        db.add(team)
        db.commit()
        db.refresh(team)
        return team.id


def safe_float(val):
    """Convert value to float, handling NaN and None"""
    import pandas as pd
    if pd.isna(val):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_int(val):
    """Convert value to int, handling NaN and None"""
    import pandas as pd
    if pd.isna(val):
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def safe_bool(val):
    """Convert value to bool, handling NaN and None"""
    import pandas as pd
    if pd.isna(val):
        return None
    try:
        return bool(val)
    except (ValueError, TypeError):
        return None


def timedelta_to_seconds(td):
    """Convert pandas Timedelta to seconds (float)"""
    if td is None:
        return None
    try:
        return td.total_seconds()
    except (AttributeError, TypeError):
        return None


def datetime_or_timedelta_to_seconds(value, session_start=None):
    """
    Convert datetime or Timedelta to seconds since session start.

    Args:
        value: datetime or Timedelta object
        session_start: datetime of session start (required if value is datetime)

    Returns:
        float: seconds since session start, or None if conversion fails
    """
    import pandas as pd
    from datetime import datetime

    if pd.isna(value) or value is None:
        return None

    try:
        # If it's a Timedelta, just get total seconds
        if hasattr(value, 'total_seconds'):
            return value.total_seconds()

        # If it's a datetime and we have session_start, calculate difference
        if isinstance(value, datetime) and session_start is not None:
            delta = value - session_start
            return delta.total_seconds()

        return None
    except (AttributeError, TypeError, ValueError):
        return None


def load_session_with_retry(year, round_num, session_name, max_retries=3):
    """
    Load a FastF1 session with retry logic and exponential backoff.

    Loads all data types: laps, weather, messages, telemetry.

    Args:
        year: Season year
        round_num: Round number
        session_name: FastF1 session name ('Race', 'Qualifying', etc.)
        max_retries: Maximum number of retry attempts

    Returns:
        Loaded FastF1 session object, or None if session doesn't exist

    Raises:
        Exception: If loading fails after all retries
    """
    for attempt in range(max_retries):
        try:
            fastf1_sess = fastf1.get_session(year, round_num, session_name)
            # Load all data types (laps includes track_status)
            fastf1_sess.load(laps=True, weather=True, messages=True)
            return fastf1_sess
        except Exception as e:
            error_msg = str(e).lower()

            # Check if this is a "session doesn't exist" error (not a real failure)
            if "no session" in error_msg or "not found" in error_msg or "invalid session" in error_msg:
                return None

            # Real error - retry with exponential backoff
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 1s, 2s, 4s
                print(f"    ⚠️  Load failed (attempt {attempt + 1}/{max_retries}): {e}")
                print(f"    ⏳ Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                # Final attempt failed
                raise

    return None


def session_exists(event, session_type_name):
    """
    Check if a session type is available for this event.

    Args:
        event: Event data from FastF1 schedule
        session_type_name: Our session type ('sprint_race' or 'sprint_qualifying')

    Returns:
        bool: True if session should exist, False otherwise
    """
    # Sprint sessions only exist at certain events
    if session_type_name in ['sprint_race', 'sprint_qualifying']:
        # Check if event has sprint (look for 'Sprint' in session names)
        # FastF1 event objects have session info in their attributes
        try:
            # The event object should have a Session5Name or similar indicating a sprint
            return hasattr(event, 'Session5Name') and event.get('Session5Name') is not None
        except Exception:
            # If we can't determine, assume it might exist and let FastF1 tell us
            return True

    # Race and qualifying exist at all events
    return True


def ingest_race_results(db, fastf1_session, session_id, year):
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

    # Get fastest lap info from laps data
    try:
        laps = fastf1_session.laps
        fastest_lap = laps.pick_fastest()
        fastest_lap_driver = fastest_lap['Driver'] if fastest_lap is not None else None
    except Exception as e:
        print(f"    ⚠️  Could not determine fastest lap: {e}")
        fastest_lap_driver = None

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
                SessionResult.driver_id == driver_id
            )
        ).scalar_one_or_none()

        if existing_result:
            continue  # Skip existing result

        # Create new result
        new_results += 1

        # Check if this driver had the fastest lap
        driver_code = driver_result["Abbreviation"]
        had_fastest_lap = (fastest_lap_driver == driver_code) if fastest_lap_driver else False

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
            laps_completed=safe_int(driver_result.get("Laps")),  # Available in FastF1 3.6+
            time_seconds=time_seconds,
            fastest_lap=had_fastest_lap,
        )
        db.add(result)

    db.commit()
    print(f"  ✓ Added {new_results} new results")


def ingest_qualifying_results(db, fastf1_session, session_id, year):
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
                SessionResult.driver_id == driver_id
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


def ingest_lap_data(db, fastf1_session, session_id):
    """
    Ingest lap-by-lap timing data for a session.

    Args:
        db: Database session
        fastf1_session: FastF1 session object (already loaded with laps=True)
        session_id: ID of the session in our database
    """
    try:
        laps = fastf1_session.laps
        if laps is None or len(laps) == 0:
            print(f"  ⏭️  No lap data available")
            return

        print(f"  📊 Processing {len(laps)} laps...")

        # Check if lap data already exists
        existing_count = db.execute(
            select(Lap).where(Lap.session_id == session_id)
        ).scalars().all()

        if len(existing_count) > 0:
            print(f"  ✓ Lap data already exists ({len(existing_count)} laps), skipping")
            return

        # Map driver codes to driver IDs
        driver_map = {}
        for driver_code in laps['Driver'].unique():
            if driver_code and str(driver_code) != 'nan':
                driver = db.execute(
                    select(Driver).where(Driver.driver_code == driver_code)
                ).scalar_one_or_none()
                if driver:
                    driver_map[driver_code] = driver.id

        new_laps = 0
        for idx, lap_data in laps.iterrows():
            driver_code = lap_data.get('Driver')
            if not driver_code or str(driver_code) == 'nan' or driver_code not in driver_map:
                continue

            driver_id = driver_map[driver_code]
            lap_number = safe_int(lap_data.get('LapNumber'))

            if not lap_number:
                continue  # Skip invalid laps

            # Convert Timedelta fields to seconds
            lap_time = timedelta_to_seconds(lap_data.get('LapTime'))
            sector1_time = timedelta_to_seconds(lap_data.get('Sector1Time'))
            sector2_time = timedelta_to_seconds(lap_data.get('Sector2Time'))
            sector3_time = timedelta_to_seconds(lap_data.get('Sector3Time'))

            # Session time fields (already in seconds or Timedelta)
            lap_start_time = timedelta_to_seconds(lap_data.get('LapStartTime'))
            sector1_session_time = timedelta_to_seconds(lap_data.get('Sector1SessionTime'))
            sector2_session_time = timedelta_to_seconds(lap_data.get('Sector2SessionTime'))
            sector3_session_time = timedelta_to_seconds(lap_data.get('Sector3SessionTime'))
            pit_in_time = timedelta_to_seconds(lap_data.get('PitInTime'))
            pit_out_time = timedelta_to_seconds(lap_data.get('PitOutTime'))

            # Get compound (tyre type)
            compound = lap_data.get('Compound')
            if compound and str(compound) != 'nan':
                compound = str(compound)
            else:
                compound = None

            # Get track status
            track_status = lap_data.get('TrackStatus')
            if track_status and str(track_status) != 'nan':
                track_status = str(track_status)
            else:
                track_status = None

            # Get deleted reason
            deleted_reason = lap_data.get('DeletedReason')
            if deleted_reason and str(deleted_reason) != 'nan':
                deleted_reason = str(deleted_reason)
            else:
                deleted_reason = None

            lap = Lap(
                session_id=session_id,
                driver_id=driver_id,
                lap_number=lap_number,
                lap_time_seconds=lap_time,
                sector1_time_seconds=sector1_time,
                sector2_time_seconds=sector2_time,
                sector3_time_seconds=sector3_time,
                lap_start_time_seconds=lap_start_time,
                sector1_session_time_seconds=sector1_session_time,
                sector2_session_time_seconds=sector2_session_time,
                sector3_session_time_seconds=sector3_session_time,
                pit_in_time_seconds=pit_in_time,
                pit_out_time_seconds=pit_out_time,
                stint=safe_int(lap_data.get('Stint')),
                speed_i1=safe_float(lap_data.get('SpeedI1')),
                speed_i2=safe_float(lap_data.get('SpeedI2')),
                speed_fl=safe_float(lap_data.get('SpeedFL')),
                speed_st=safe_float(lap_data.get('SpeedST')),
                compound=compound,
                tyre_life=safe_int(lap_data.get('TyreLife')),
                fresh_tyre=safe_bool(lap_data.get('FreshTyre')),
                position=safe_int(lap_data.get('Position')),
                track_status=track_status,
                is_personal_best=safe_bool(lap_data.get('IsPersonalBest')),
                is_accurate=safe_bool(lap_data.get('IsAccurate')),
                deleted=safe_bool(lap_data.get('Deleted')),
                deleted_reason=deleted_reason,
            )
            db.add(lap)
            new_laps += 1

        db.commit()
        print(f"  ✓ Added {new_laps} laps")

    except Exception as e:
        print(f"  ⚠️  Could not ingest lap data: {e}")
        db.rollback()


def ingest_weather_data(db, fastf1_session, session_id):
    """
    Ingest weather data for a session.

    Args:
        db: Database session
        fastf1_session: FastF1 session object (already loaded with weather=True)
        session_id: ID of the session in our database
    """
    try:
        weather_data = fastf1_session.weather_data
        if weather_data is None or len(weather_data) == 0:
            print(f"  ⏭️  No weather data available")
            return

        print(f"  🌤️  Processing {len(weather_data)} weather readings...")

        # Check if weather data already exists
        existing_count = db.execute(
            select(Weather).where(Weather.session_id == session_id)
        ).scalars().all()

        if len(existing_count) > 0:
            print(f"  ✓ Weather data already exists ({len(existing_count)} readings), skipping")
            return

        new_readings = 0
        for idx, weather_row in weather_data.iterrows():
            # Convert Time to seconds if it's a Timedelta
            session_time = timedelta_to_seconds(weather_row.get('Time'))
            if session_time is None:
                continue

            weather = Weather(
                session_id=session_id,
                session_time_seconds=session_time,
                air_temp=safe_float(weather_row.get('AirTemp')),
                track_temp=safe_float(weather_row.get('TrackTemp')),
                humidity=safe_float(weather_row.get('Humidity')),
                pressure=safe_float(weather_row.get('Pressure')),
                wind_speed=safe_float(weather_row.get('WindSpeed')),
                wind_direction=safe_int(weather_row.get('WindDirection')),
                rainfall=safe_bool(weather_row.get('Rainfall')),
            )
            db.add(weather)
            new_readings += 1

        db.commit()
        print(f"  ✓ Added {new_readings} weather readings")

    except Exception as e:
        print(f"  ⚠️  Could not ingest weather data: {e}")
        db.rollback()


def ingest_track_status(db, fastf1_session, session_id):
    """
    Ingest track status changes for a session.

    Args:
        db: Database session
        fastf1_session: FastF1 session object (already loaded with laps=True)
        session_id: ID of the session in our database
    """
    try:
        track_status_data = fastf1_session.track_status
        if track_status_data is None or len(track_status_data) == 0:
            print(f"  ⏭️  No track status data available")
            return

        print(f"  🚦 Processing {len(track_status_data)} track status changes...")

        # Check if track status data already exists
        existing_count = db.execute(
            select(TrackStatus).where(TrackStatus.session_id == session_id)
        ).scalars().all()

        if len(existing_count) > 0:
            print(f"  ✓ Track status data already exists ({len(existing_count)} changes), skipping")
            return

        new_statuses = 0
        for idx, status_row in track_status_data.iterrows():
            # Convert Time to seconds
            session_time = timedelta_to_seconds(status_row.get('Time'))
            if session_time is None:
                continue

            # Get status code
            status = status_row.get('Status')
            if status and str(status) != 'nan':
                status = str(status)
            else:
                continue  # Skip if no status

            # Get message
            message = status_row.get('Message')
            if message and str(message) != 'nan':
                message = str(message)
            else:
                message = None

            track_status = TrackStatus(
                session_id=session_id,
                session_time_seconds=session_time,
                status=status,
                message=message,
            )
            db.add(track_status)
            new_statuses += 1

        db.commit()
        print(f"  ✓ Added {new_statuses} track status changes")

    except Exception as e:
        print(f"  ⚠️  Could not ingest track status data: {e}")
        db.rollback()


def ingest_race_control_messages(db, fastf1_session, session_id):
    """
    Ingest race control messages for a session.

    Args:
        db: Database session
        fastf1_session: FastF1 session object (already loaded with messages=True)
        session_id: ID of the session in our database
    """
    try:
        messages_data = fastf1_session.race_control_messages
        if messages_data is None or len(messages_data) == 0:
            print(f"  ⏭️  No race control messages available")
            return

        print(f"  📋 Processing {len(messages_data)} race control messages...")

        # Check if messages already exist
        existing_count = db.execute(
            select(RaceControlMessage).where(RaceControlMessage.session_id == session_id)
        ).scalars().all()

        if len(existing_count) > 0:
            print(f"  ✓ Race control messages already exist ({len(existing_count)} messages), skipping")
            return

        # Get session start time (needed because race control messages use absolute datetime)
        # FastF1 uses 't0_date' as the reference timestamp
        session_start = fastf1_session.t0_date if hasattr(fastf1_session, 't0_date') else None

        new_messages = 0
        for idx, msg_row in messages_data.iterrows():
            # Convert Time to seconds (handles both datetime and Timedelta)
            session_time = datetime_or_timedelta_to_seconds(msg_row.get('Time'), session_start)
            if session_time is None:
                continue

            # Get message text
            message = msg_row.get('Message')
            if not message or str(message) == 'nan':
                continue  # Skip if no message

            # Get category
            category = msg_row.get('Category')
            if category and str(category) != 'nan':
                category = str(category)
            else:
                category = None

            # Get status
            status = msg_row.get('Status')
            if status and str(status) != 'nan':
                status = str(status)
            else:
                status = None

            # Get flag
            flag = msg_row.get('Flag')
            if flag and str(flag) != 'nan':
                flag = str(flag)
            else:
                flag = None

            # Get scope
            scope = msg_row.get('Scope')
            if scope and str(scope) != 'nan':
                scope = str(scope)
            else:
                scope = None

            race_control_msg = RaceControlMessage(
                session_id=session_id,
                session_time_seconds=session_time,
                category=category,
                message=str(message),
                status=status,
                driver_number=safe_int(msg_row.get('RacingNumber')),
                flag=flag,
                scope=scope,
                sector=safe_int(msg_row.get('Sector')),
                lap_number=safe_int(msg_row.get('Lap')),
            )
            db.add(race_control_msg)
            new_messages += 1

        db.commit()
        print(f"  ✓ Added {new_messages} race control messages")

    except Exception as e:
        print(f"  ⚠️  Could not ingest race control messages: {e}")
        db.rollback()


def check_session_in_db(db, year, round_num, session_type_name):
    """
    Check if session and its data already exist in database.

    Checks for all data types: results, laps, weather, track status, race control messages.

    Args:
        db: Database session
        year: Season year
        round_num: Round number
        session_type_name: Our session type ('race', 'qualifying', 'sprint_race', 'sprint_qualifying')

    Returns:
        tuple: (session_exists, has_results, has_laps, has_weather, has_track_status, has_messages, session_id)
    """
    # Check if session exists
    existing_session = db.execute(
        select(Session).where(
            Session.year == year,
            Session.round == round_num,
            Session.session_type == session_type_name
        )
    ).scalar_one_or_none()

    if not existing_session:
        return False, False, False, False, False, False, None

    session_id = existing_session.id

    # Check if each data type exists
    has_results = len(db.execute(
        select(SessionResult).where(SessionResult.session_id == session_id)
    ).scalars().all()) > 0

    has_laps = len(db.execute(
        select(Lap).where(Lap.session_id == session_id)
    ).scalars().all()) > 0

    has_weather = len(db.execute(
        select(Weather).where(Weather.session_id == session_id)
    ).scalars().all()) > 0

    has_track_status = len(db.execute(
        select(TrackStatus).where(TrackStatus.session_id == session_id)
    ).scalars().all()) > 0

    has_messages = len(db.execute(
        select(RaceControlMessage).where(RaceControlMessage.session_id == session_id)
    ).scalars().all()) > 0

    return True, has_results, has_laps, has_weather, has_track_status, has_messages, session_id


def ingest_session(db, year, round_num, event, session_type_name, fastf1_session_name, strict_mode=False):
    """
    Ingest a single session (race, qualifying, sprint, etc.).

    IMPORTANT: Checks database FIRST before loading from FastF1 to avoid unnecessary API calls.
    Checks each data type independently and only ingests what's missing.

    Args:
        db: Database session
        year: Season year
        round_num: Round number
        event: Event data from schedule
        session_type_name: Our session type ('race', 'qualifying', 'sprint_race', 'sprint_qualifying')
        fastf1_session_name: FastF1 session name ('Race', 'Qualifying', 'Sprint', 'Sprint Qualifying')
        strict_mode: If True, raise exceptions instead of continuing

    Returns:
        bool: True if successful, False if failed/skipped
    """
    # STEP 1: Check what data already exists in database
    session_exists, has_results, has_laps, has_weather, has_track_status, has_messages, session_id = check_session_in_db(
        db, year, round_num, session_type_name
    )

    # Determine if we need to load anything from FastF1
    needs_results = not has_results
    needs_laps = not has_laps
    needs_weather = not has_weather
    needs_track_status = not has_track_status
    needs_messages = not has_messages

    # If everything exists, skip entirely
    if session_exists and has_results and has_laps and has_weather and has_track_status and has_messages:
        print(f"  ✓ All data already in database, skipping")
        return True

    # Report what exists
    if session_exists:
        existing_data = []
        if has_results:
            existing_data.append("results")
        if has_laps:
            existing_data.append("laps")
        if has_weather:
            existing_data.append("weather")
        if has_track_status:
            existing_data.append("track status")
        if has_messages:
            existing_data.append("messages")

        if existing_data:
            print(f"  ✓ Existing data: {', '.join(existing_data)}")

        missing_data = []
        if needs_results:
            missing_data.append("results")
        if needs_laps:
            missing_data.append("laps")
        if needs_weather:
            missing_data.append("weather")
        if needs_track_status:
            missing_data.append("track status")
        if needs_messages:
            missing_data.append("messages")

        if missing_data:
            print(f"  📥 Will ingest: {', '.join(missing_data)}")

    # STEP 2: Ingest circuit (fast database operation)
    circuit_id = ingest_circuit(db, event)

    # STEP 3: Load from FastF1 only if needed
    print(f"  📥 Loading {fastf1_session_name} data from FastF1...")
    try:
        fastf1_sess = load_session_with_retry(year, round_num, fastf1_session_name)

        if fastf1_sess is None:
            # Session doesn't exist (e.g., no sprint at this event)
            print(f"  ⏭️  {fastf1_session_name} not available for this event")
            return False

        # STEP 4: Create/update session metadata if needed
        if not session_exists:
            session_date = fastf1_sess.date if hasattr(fastf1_sess, 'date') else event.get("EventDate")
            session_id, _ = ingest_session_metadata(
                db, event, circuit_id, year, session_type_name, session_date
            )

        # STEP 5: Ingest results (only if needed)
        if needs_results:
            try:
                if session_type_name in ['race', 'sprint_race']:
                    ingest_race_results(db, fastf1_sess, session_id, year)
                elif session_type_name in ['qualifying', 'sprint_qualifying']:
                    ingest_qualifying_results(db, fastf1_sess, session_id, year)
            except Exception as e:
                print(f"  ❌ Error ingesting results: {e}")
                if strict_mode:
                    raise
                return False

        # STEP 6: Ingest additional data (only what's needed)
        # Each function has its own DB check, but we can skip the call entirely if data exists
        if needs_laps or needs_weather or needs_track_status or needs_messages:
            print(f"\n  📥 Ingesting additional session data...")

        # Track which data ingestions fail (for partial failure detection)
        partial_failures = []

        if needs_laps:
            try:
                ingest_lap_data(db, fastf1_sess, session_id)
            except Exception as e:
                print(f"  ⚠️  Failed to ingest lap data: {e}")
                partial_failures.append('laps')
                if strict_mode:
                    raise

        if needs_weather:
            try:
                ingest_weather_data(db, fastf1_sess, session_id)
            except Exception as e:
                print(f"  ⚠️  Failed to ingest weather data: {e}")
                partial_failures.append('weather')
                if strict_mode:
                    raise

        if needs_track_status:
            try:
                ingest_track_status(db, fastf1_sess, session_id)
            except Exception as e:
                print(f"  ⚠️  Failed to ingest track status: {e}")
                partial_failures.append('track_status')
                if strict_mode:
                    raise

        if needs_messages:
            try:
                ingest_race_control_messages(db, fastf1_sess, session_id)
            except Exception as e:
                print(f"  ⚠️  Failed to ingest race control messages: {e}")
                partial_failures.append('messages')
                if strict_mode:
                    raise

        if partial_failures:
            print(f"  ⚠️  Partial ingestion: missing {', '.join(partial_failures)}")
            # Still return False to track as failure
            return False

        return True

    except Exception as e:
        print(f"  ❌ Error loading {fastf1_session_name} data: {e}")
        if strict_mode:
            raise
        return False


def ingest_season(season_year, session_types=None, strict_mode=False):
    """
    Main function: Ingest all sessions for a given season.

    Args:
        season_year: Year to ingest (e.g., 2024)
        session_types: List of session types to ingest (defaults to all)
        strict_mode: If True, fail fast on any error instead of continuing
    """
    if session_types is None:
        session_types = DEFAULT_SESSION_TYPES

    print(f"\n{'='*60}")
    print(f"INGESTING {season_year} SEASON")
    print(f"Session types: {', '.join(session_types)}")
    if strict_mode:
        print(f"Mode: STRICT (fail fast on errors)")
    print(f"{'='*60}\n")

    # Enable FastF1 cache (use absolute path for consistency)
    cache_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../cache"))
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
    fastf1.Cache.enable_cache(cache_dir)
    print(f"📁 Using cache directory: {cache_dir}\n")

    # Get database session
    db = get_db_session()

    # Mapping of our session types to FastF1 session names
    SESSION_TYPE_MAP = {
        'race': 'Race',
        'qualifying': 'Qualifying',
        'sprint_race': 'Sprint',
        'sprint_qualifying': 'Sprint Qualifying',
    }

    # Track success/failure
    stats = {
        'total_sessions_attempted': 0,
        'successful': 0,
        'already_exists': 0,  # Already in database
        'not_available': 0,   # Session doesn't exist (e.g., no sprint)
        'failed': 0,
        'failures': []  # List of (round, session_type, error) tuples
    }

    try:
        # Get season schedule
        print(f"📅 Fetching {season_year} schedule...")
        schedule = fastf1.get_event_schedule(season_year)
        print(f"   Found {len(schedule)} events\n")

        # Process each race weekend
        for index, event in schedule.iterrows():
            round_num = event["RoundNumber"]
            event_name = event["EventName"]

            # Skip testing events
            if round_num == 0:
                print(f"⏭️  Skipping: {event_name}\n")
                continue

            print(f"🏁 Round {round_num}: {event_name}")

            # Ingest each requested session type
            for session_type in session_types:
                if session_type not in SESSION_TYPE_MAP:
                    print(f"  ⚠️  Unknown session type: {session_type}, skipping")
                    continue

                fastf1_session_name = SESSION_TYPE_MAP[session_type]
                print(f"\n  🔹 {session_type.upper()}")

                stats['total_sessions_attempted'] += 1

                # Check what data already exists
                (session_exists, has_results, has_laps, has_weather,
                 has_track_status, has_messages, _) = check_session_in_db(db, season_year, round_num, session_type)

                # If ALL data exists, skip entirely
                if session_exists and has_results and has_laps and has_weather and has_track_status and has_messages:
                    print(f"  ✓ All data already in database")
                    stats['already_exists'] += 1
                    continue

                # Otherwise, call ingest_session which will handle partial data
                try:
                    success = ingest_session(
                        db, season_year, round_num, event,
                        session_type, fastf1_session_name,
                        strict_mode=strict_mode
                    )
                    if success:
                        stats['successful'] += 1
                    else:
                        # Session doesn't exist (e.g., no sprint at this event)
                        stats['not_available'] += 1
                except Exception as e:
                    stats['failed'] += 1
                    stats['failures'].append((round_num, event_name, session_type, str(e)))
                    print(f"  ❌ Failed to ingest {session_type}: {e}")
                    if strict_mode:
                        raise
                    continue

            print()  # Blank line between events

        # Print summary
        print(f"{'='*60}")
        print(f"✅ INGESTION COMPLETE!")
        print(f"{'='*60}")
        print(f"📊 Summary:")
        print(f"   Total sessions checked: {stats['total_sessions_attempted']}")
        print(f"   ✓ Newly ingested: {stats['successful']}")
        print(f"   ✓ Already in database: {stats['already_exists']}")
        print(f"   ⏭️  Not available (no sprint): {stats['not_available']}")
        print(f"   ❌ Failed: {stats['failed']}")

        if stats['failures']:
            print(f"\n⚠️  Failed sessions:")
            for round_num, event_name, session_type, error in stats['failures']:
                print(f"   - R{round_num} {event_name} ({session_type}): {error}")

            # Write failures to log file for tracking
            write_failure_log(season_year, stats['failures'])

            # Recommend running audit
            print(f"\n💡 Recommendation:")
            print(f"   Run audit to verify database state:")
            print(f"   PYTHONPATH=$PWD python scripts/audit_database.py {season_year}")

        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # Parse command line arguments
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2024

    # Optional: specify session types (e.g., python ingest_season.py 2024 race,qualifying)
    # Changed default to match DEFAULT_SESSION_TYPES
    if len(sys.argv) > 2 and not sys.argv[2].startswith('--'):
        session_types = sys.argv[2].split(',')
    else:
        session_types = ['race', 'qualifying', 'sprint_race', 'sprint_qualifying']

    # Optional: strict mode flag (--strict)
    strict_mode = '--strict' in sys.argv

    ingest_season(season, session_types, strict_mode=strict_mode)
