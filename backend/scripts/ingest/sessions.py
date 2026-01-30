
from sqlalchemy import select
from app.models import Session

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
            Session.session_type == session_type,
        )
    ).scalar_one_or_none()

    if existing_session:
        print(f"  ✓ Session exists: {year} R{round_num} {session_type}")
        return existing_session.id, False  # Don't process results
    else:
        print(
            f"  + Creating session: {year} R{round_num} {session_type} - {event_name}"
        )
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
