from sqlalchemy import select, delete as sql_delete, func
from app.models import Session, SessionResult, Lap, Weather, TrackStatus


def ingest_session_metadata(
    db, event, circuit_id, year, session_type, session_date, mode="override"
):
    """
    Ingest session metadata.

    Modes:
        override (default): Always wipe child data and re-ingest.
                            Used by ingest_season.py for historical re-runs.
        append:             Skip if session already has results.
                            Wipe only if session exists with no results (failed prior run).
                            Used by ingest_single.py for automated pipeline.

    Returns: (session_id, should_process_results)
    """
    round_num = int(event["RoundNumber"])
    event_name = event["EventName"]

    existing_session = db.execute(
        select(Session).where(
            Session.year == year,
            Session.round == round_num,
            Session.session_type == session_type,
        )
    ).scalar_one_or_none()

    if existing_session:
        if mode == "append":
            result_count = db.execute(
                select(func.count()).where(
                    SessionResult.session_id == existing_session.id
                )
            ).scalar()
            lap_count = db.execute(
                select(func.count()).where(Lap.session_id == existing_session.id)
            ).scalar()

            # Since 2018, charts and sector comparisons depend on FastF1 lap
            # data. Results-only sessions are partial ingestions, not complete
            # sessions, and must be retried on the next pipeline run.
            is_complete = result_count and result_count > 0
            if year >= 2018:
                is_complete = is_complete and lap_count and lap_count > 0

            if is_complete:
                print(
                    f"  ✓ Already ingested: {year} R{round_num} {session_type} "
                    f"({result_count} results, {lap_count} laps) — skipping"
                )
                return existing_session.id, False

            print(
                f"  ↻ Found incomplete {year} R{round_num} {session_type} "
                f"({result_count or 0} results, {lap_count or 0} laps)"
            )

        # Wipe all child data so this run produces a clean, correct dataset
        db.execute(
            sql_delete(SessionResult).where(
                SessionResult.session_id == existing_session.id
            )
        )
        db.execute(sql_delete(Lap).where(Lap.session_id == existing_session.id))
        db.execute(sql_delete(Weather).where(Weather.session_id == existing_session.id))
        db.execute(
            sql_delete(TrackStatus).where(TrackStatus.session_id == existing_session.id)
        )
        db.commit()
        print(
            f"  ↻ Cleared existing data: {year} R{round_num} {session_type} (re-ingesting)"
        )
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
