from sqlalchemy import select

from app.models import DriverSeason, Lap, Session, SessionResult, TrackStatus, Weather

from .utils import safe_bool, safe_float, safe_int, timedelta_to_seconds


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
            print("  ⏭️  No lap data available")
            return 0

        print(f"  📊 Processing {len(laps)} laps...")

        # sessions.py clears laps before re-ingestion; this is a safety net only
        existing_count = (
            db.execute(select(Lap).where(Lap.session_id == session_id)).scalars().all()
        )

        if len(existing_count) > 0:
            print(f"  ✓ Lap data already exists ({len(existing_count)} laps), skipping")
            return len(existing_count)

        # Abbreviations are only unique within a season/session. Resolve through
        # participants already written for this exact session, never globally.
        participant_rows = db.execute(
            select(DriverSeason.driver_code, SessionResult.driver_id)
            .join(Session, Session.year == DriverSeason.year)
            .join(
                SessionResult,
                (SessionResult.session_id == Session.id)
                & (SessionResult.driver_id == DriverSeason.driver_id),
            )
            .where(Session.id == session_id)
        ).all()
        driver_map = {row.driver_code: row.driver_id for row in participant_rows}

        new_laps = 0
        for idx, lap_data in laps.iterrows():
            driver_code = lap_data.get("Driver")
            if (
                not driver_code
                or str(driver_code) == "nan"
                or driver_code not in driver_map
            ):
                continue

            driver_id = driver_map[driver_code]
            lap_number = safe_int(lap_data.get("LapNumber"))

            if not lap_number:
                continue  # Skip invalid laps

            # Convert Timedelta fields to seconds
            lap_time = timedelta_to_seconds(lap_data.get("LapTime"))
            sector1_time = timedelta_to_seconds(lap_data.get("Sector1Time"))
            sector2_time = timedelta_to_seconds(lap_data.get("Sector2Time"))
            sector3_time = timedelta_to_seconds(lap_data.get("Sector3Time"))

            # Session time fields (already in seconds or Timedelta)
            lap_start_time = timedelta_to_seconds(lap_data.get("LapStartTime"))
            sector1_session_time = timedelta_to_seconds(
                lap_data.get("Sector1SessionTime")
            )
            sector2_session_time = timedelta_to_seconds(
                lap_data.get("Sector2SessionTime")
            )
            sector3_session_time = timedelta_to_seconds(
                lap_data.get("Sector3SessionTime")
            )
            pit_in_time = timedelta_to_seconds(lap_data.get("PitInTime"))
            pit_out_time = timedelta_to_seconds(lap_data.get("PitOutTime"))

            # Get compound (tyre type)
            compound = lap_data.get("Compound")
            if compound and str(compound) != "nan":
                compound = str(compound)
            else:
                compound = None

            # Get track status
            track_status = lap_data.get("TrackStatus")
            if track_status and str(track_status) != "nan":
                track_status = str(track_status)
            else:
                track_status = None

            # Get deleted reason
            deleted_reason = lap_data.get("DeletedReason")
            if deleted_reason and str(deleted_reason) != "nan":
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
                stint=safe_int(lap_data.get("Stint")),
                speed_i1=safe_float(lap_data.get("SpeedI1")),
                speed_i2=safe_float(lap_data.get("SpeedI2")),
                speed_fl=safe_float(lap_data.get("SpeedFL")),
                speed_st=safe_float(lap_data.get("SpeedST")),
                compound=compound,
                tyre_life=safe_int(lap_data.get("TyreLife")),
                fresh_tyre=safe_bool(lap_data.get("FreshTyre")),
                position=safe_int(lap_data.get("Position")),
                track_status=track_status,
                is_personal_best=safe_bool(lap_data.get("IsPersonalBest")),
                is_accurate=safe_bool(lap_data.get("IsAccurate")),
                deleted=safe_bool(lap_data.get("Deleted")),
                deleted_reason=deleted_reason,
                source="fastf1",
            )
            db.add(lap)
            new_laps += 1

        db.commit()
        print(f"  ✓ Added {new_laps} laps")
        return new_laps

    except Exception as e:
        print(f"  ⚠️  Could not ingest lap data: {e}")
        db.rollback()
        return 0


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
            print("  ⏭️  No weather data available")
            return

        print(f"  🌤️  Processing {len(weather_data)} weather readings...")

        # sessions.py clears weather before re-ingestion; this is a safety net only
        existing_count = (
            db.execute(select(Weather).where(Weather.session_id == session_id))
            .scalars()
            .all()
        )

        if len(existing_count) > 0:
            print(
                f"  ✓ Weather data already exists ({len(existing_count)} readings), skipping"
            )
            return

        new_readings = 0
        for idx, weather_row in weather_data.iterrows():
            # Convert Time to seconds if it's a Timedelta
            session_time = timedelta_to_seconds(weather_row.get("Time"))
            if session_time is None:
                continue

            weather = Weather(
                session_id=session_id,
                session_time_seconds=session_time,
                air_temp=safe_float(weather_row.get("AirTemp")),
                track_temp=safe_float(weather_row.get("TrackTemp")),
                humidity=safe_float(weather_row.get("Humidity")),
                pressure=safe_float(weather_row.get("Pressure")),
                wind_speed=safe_float(weather_row.get("WindSpeed")),
                wind_direction=safe_int(weather_row.get("WindDirection")),
                rainfall=safe_bool(weather_row.get("Rainfall")),
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
            print("  ⏭️  No track status data available")
            return

        print(f"  🚦 Processing {len(track_status_data)} track status changes...")

        # sessions.py clears track status before re-ingestion; this is a safety net only
        existing_count = (
            db.execute(select(TrackStatus).where(TrackStatus.session_id == session_id))
            .scalars()
            .all()
        )

        if len(existing_count) > 0:
            print(
                f"  ✓ Track status data already exists ({len(existing_count)} changes), skipping"
            )
            return

        new_statuses = 0
        for idx, status_row in track_status_data.iterrows():
            # Convert Time to seconds
            session_time = timedelta_to_seconds(status_row.get("Time"))
            if session_time is None:
                continue

            # Get status code
            status = status_row.get("Status")
            if status and str(status) != "nan":
                status = str(status)
            else:
                continue  # Skip if no status

            # Get message
            message = status_row.get("Message")
            if message and str(message) != "nan":
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
