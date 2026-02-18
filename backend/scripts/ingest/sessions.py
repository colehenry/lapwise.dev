
from sqlalchemy import select, delete as sql_delete
from app.models import Session, SessionResult, Lap, Weather, TrackStatus


def ingest_session_metadata(db, event, circuit_id, year, session_type, session_date):
    """
    Ingest session metadata.

    If the session already exists its results, laps, weather, and track status
    are deleted so the caller can re-ingest them cleanly (override mode).

    Returns: (session_id, should_process_results)
    """
    round_num = event["RoundNumber"]
    event_name = event["EventName"]

    existing_session = db.execute(
        select(Session).where(
            Session.year == year,
            Session.round == round_num,
            Session.session_type == session_type,
        )
    ).scalar_one_or_none()

    if existing_session:
        # Wipe all child data so this run produces a clean, correct dataset
        db.execute(sql_delete(SessionResult).where(SessionResult.session_id == existing_session.id))
        db.execute(sql_delete(Lap).where(Lap.session_id == existing_session.id))
        db.execute(sql_delete(Weather).where(Weather.session_id == existing_session.id))
        db.execute(sql_delete(TrackStatus).where(TrackStatus.session_id == existing_session.id))
        db.commit()
        print(f"  ↻ Cleared existing data: {year} R{round_num} {session_type} (re-ingesting)")
        return existing_session.id, True

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
    return session.id, True
