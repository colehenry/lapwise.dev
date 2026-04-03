from sqlalchemy import select
from app.models import RaceControlMessage
from .utils import timedelta_to_seconds, safe_int


def ingest_race_control_messages(db, fastf1_session, session_id):
    """
    Ingest race control messages for a session.

    Args:
        db: Database session
        fastf1_session: FastF1 session object (loaded with messages=True)
        session_id: ID of the session in our database
    """
    try:
        rcm_data = fastf1_session.race_control_messages
        if rcm_data is None or len(rcm_data) == 0:
            print("  ⏭️  No race control messages available")
            return

        print(f"  📢 Processing {len(rcm_data)} race control messages...")

        existing_count = (
            db.execute(
                select(RaceControlMessage).where(
                    RaceControlMessage.session_id == session_id
                )
            )
            .scalars()
            .all()
        )

        if len(existing_count) > 0:
            print(
                f"  ✓ Race control messages already exist "
                f"({len(existing_count)} messages), skipping"
            )
            return

        new_messages = 0
        for idx, row in rcm_data.iterrows():
            session_time = timedelta_to_seconds(row.get("Time"))
            if session_time is None:
                continue

            message = row.get("Message")
            if not message or str(message) == "nan":
                continue
            message = str(message)

            category = row.get("Category")
            if category and str(category) != "nan":
                category = str(category)
            else:
                category = None

            status = row.get("Status")
            if status and str(status) != "nan":
                status = str(status)
            else:
                status = None

            flag = row.get("Flag")
            if flag and str(flag) != "nan":
                flag = str(flag)
            else:
                flag = None

            scope = row.get("Scope")
            if scope and str(scope) != "nan":
                scope = str(scope)
            else:
                scope = None

            rcm = RaceControlMessage(
                session_id=session_id,
                session_time_seconds=session_time,
                category=category,
                message=message,
                status=status,
                driver_number=safe_int(row.get("RacingNumber")),
                flag=flag,
                scope=scope,
                sector=safe_int(row.get("Sector")),
                lap_number=safe_int(row.get("Lap")),
            )
            db.add(rcm)
            new_messages += 1

        db.commit()
        print(f"  ✓ Added {new_messages} race control messages")

    except Exception as e:
        print(f"  ⚠️  Could not ingest race control messages: {e}")
        db.rollback()
