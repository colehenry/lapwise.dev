
import os
import json
import time
import fastf1
import pandas as pd
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

def write_failure_log(season_year, failures):
    """
    Write ingestion failures to a persistent log file.
    """
    if not failures:
        return

    log_dir = os.path.join(os.path.dirname(__file__), "../../logs")
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    log_file = os.path.join(log_dir, f"ingestion_failures_{season_year}.json")

    failure_records = []
    for round_num, event_name, session_type, error in failures:
        failure_records.append(
            {
                "timestamp": datetime.now().isoformat(),
                "season": season_year,
                "round": round_num,
                "event_name": event_name,
                "session_type": session_type,
                "error": str(error),
            }
        )

    # Append to existing log or create new
    existing_failures = []
    if os.path.exists(log_file):
        try:
            with open(log_file, "r") as f:
                existing_failures = json.load(f)
        except Exception:
            pass  # If can't read, start fresh

    all_failures = existing_failures + failure_records

    with open(log_file, "w") as f:
        json.dump(all_failures, f, indent=2)

    print(f"\n📝 Failure log written to: {log_file}")


def get_db_session():
    """Create a synchronous database session for ingestion."""
    # Convert async URL to sync URL for script usage
    database_url = settings.database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )

    # Handle SSL parameter for Neon/cloud databases
    if "?ssl=require" in database_url:
        database_url = database_url.replace("?ssl=require", "?sslmode=require")

    engine = create_engine(database_url, echo=False)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def safe_float(val):
    """Convert value to float, handling NaN and None"""
    if pd.isna(val):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_int(val):
    """Convert value to int, handling NaN and None"""
    if pd.isna(val):
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def safe_bool(val):
    """Convert value to bool, handling NaN and None"""
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
    """
    if pd.isna(value) or value is None:
        return None

    try:
        # If it's a Timedelta, just get total seconds
        if hasattr(value, "total_seconds"):
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

    Note: For pre-2018 seasons, laps, weather, and messages data are not available.
    The function automatically adjusts what data to load based on the year.
    """
    for attempt in range(max_retries):
        try:
            fastf1_sess = fastf1.get_session(year, round_num, session_name)

            # Pre-2018: Only load basic session data (no laps, weather, or messages)
            # 2018+: Load all data types (laps includes track_status)
            if year < 2018:
                print(f"    ℹ️  Loading basic data only (pre-2018 season)")
                fastf1_sess.load(laps=False, weather=False, messages=False)
            else:
                fastf1_sess.load(laps=True, weather=True, messages=True)

            return fastf1_sess
        except Exception as e:
            error_msg = str(e).lower()

            # Check if this is a "session doesn't exist" error (not a real failure)
            if (
                "no session" in error_msg
                or "not found" in error_msg
                or "invalid session" in error_msg
            ):
                return None

            # Real error - retry with exponential backoff
            if attempt < max_retries - 1:
                wait_time = 2**attempt  # 1s, 2s, 4s
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
    """
    # Sprint sessions only exist at certain events
    if session_type_name in ["sprint_race", "sprint_qualifying"]:
        # Check if event has sprint (look for 'Sprint' in session names)
        # FastF1 event objects have session info in their attributes
        try:
            # The event object should have a Session5Name or similar indicating a sprint
            return (
                hasattr(event, "Session5Name") and event.get("Session5Name") is not None
            )
        except Exception:
            # If we can't determine, assume it might exist and let FastF1 tell us
            return True

    # Race and qualifying exist at all events
    return True
