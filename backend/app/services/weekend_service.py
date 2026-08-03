"""Race-weekend availability: which sessions a round actually has."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Circuit, Session, SessionResult, SessionSummary
from app.schemas.weekend import RoundAvailabilityResponse

PRACTICE_TYPES = {"fp1": 1, "fp2": 2, "fp3": 3}
SPRINT_TYPES = {"sprint_race", "sprint_qualifying"}


class WeekendService:
    """Session availability for one race weekend."""

    @staticmethod
    async def get_round_availability(
        db: AsyncSession, season: int, round_number: int
    ) -> RoundAvailabilityResponse | None:
        rows = (
            await db.execute(
                select(
                    Session.session_type,
                    Session.event_name,
                    Session.date,
                    Session.circuit_id,
                    Circuit.name,
                    func.count(SessionResult.id).label("result_count"),
                )
                .join(Circuit, Circuit.id == Session.circuit_id)
                .outerjoin(SessionResult, SessionResult.session_id == Session.id)
                .where(Session.year == season, Session.round == round_number)
                .group_by(
                    Session.session_type,
                    Session.event_name,
                    Session.date,
                    Session.circuit_id,
                    Circuit.name,
                )
                .order_by(Session.date)
            )
        ).all()
        if not rows:
            return None

        # A session row with no results cannot fill a tab, so it is not offered.
        scored = [row for row in rows if row.result_count > 0]
        if not scored:
            return None

        session_types = sorted({row.session_type for row in scored})
        practice_numbers = sorted(
            PRACTICE_TYPES[session_type]
            for session_type in session_types
            if session_type in PRACTICE_TYPES
        )
        first = scored[0]

        summary_types = list(
            await db.scalars(
                select(Session.session_type)
                .join(SessionSummary, SessionSummary.session_id == Session.id)
                .where(Session.year == season, Session.round == round_number)
                .distinct()
            )
        )

        return RoundAvailabilityResponse(
            season=season,
            round=round_number,
            event_name=first.event_name,
            date=first.date,
            circuit_id=first.circuit_id,
            circuit_name=first.name,
            session_types=session_types,
            practice_numbers=practice_numbers,
            has_sprint=any(
                session_type in SPRINT_TYPES for session_type in session_types
            ),
            summary_session_types=sorted(summary_types),
        )
