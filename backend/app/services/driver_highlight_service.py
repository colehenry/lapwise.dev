"""Career highlights and profile superlatives derived from canonical results."""

from collections import Counter

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DriverChampionshipStanding, Session, SessionResult, Team
from app.schemas.driver import DriverSuperlative, DriverSuperlativesResponse
from app.services.driver_attribute_service import DriverAttributes
from app.services.driver_fact_common import FactCandidate, noun
from app.services.driver_identity_service import DriverIdentityService

RANK_SUBLABEL_LIMIT = 50


class DriverHighlightService:
    """Build career totals and rankings for winner and driver-profile surfaces."""

    @staticmethod
    def _rank_sublabel(rank: int) -> str | None:
        """An all-time rank only informs while the driver is near the top."""
        if rank == 1:
            return "all-time leader"
        if rank <= RANK_SUBLABEL_LIMIT:
            return f"#{rank} all-time"
        return None

    @staticmethod
    async def highlights(
        db: AsyncSession,
        driver: DriverAttributes,
        include_sprint: bool = False,
    ) -> list[FactCandidate]:
        session_types = ["race", "sprint_race"] if include_sprint else ["race"]
        rows = (
            await db.execute(
                select(
                    SessionResult.position,
                    SessionResult.grid_position,
                    Session.event_name,
                    Session.year,
                    Team.constructor_id,
                    Team.name,
                )
                .join(Session, Session.id == SessionResult.session_id)
                .join(Team, Team.id == SessionResult.team_id)
                .where(
                    SessionResult.driver_id == driver.driver_id,
                    Session.session_type.in_(session_types),
                )
                .order_by(Session.date, Session.round)
            )
        ).all()
        championships = int(
            await db.scalar(
                select(func.count())
                .select_from(DriverChampionshipStanding)
                .where(
                    DriverChampionshipStanding.driver_id == driver.driver_id,
                    DriverChampionshipStanding.position == 1,
                    DriverChampionshipStanding.is_final.is_(True),
                )
            )
            or 0
        )
        wins = sum(row.position == 1 for row in rows)
        podiums = sum(row.position in (1, 2, 3) for row in rows)
        poles = sum(row.grid_position == 1 for row in rows)
        aggregate_rows = (
            await db.execute(
                select(
                    SessionResult.driver_id,
                    func.count(SessionResult.id).label("starts"),
                    func.sum(case((SessionResult.position == 1, 1), else_=0)).label(
                        "wins"
                    ),
                    func.sum(
                        case((SessionResult.position.in_((1, 2, 3)), 1), else_=0)
                    ).label("podiums"),
                    func.sum(
                        case((SessionResult.grid_position == 1, 1), else_=0)
                    ).label("poles"),
                )
                .join(Session, Session.id == SessionResult.session_id)
                .where(Session.session_type.in_(session_types))
                .group_by(SessionResult.driver_id)
            )
        ).all()
        values = {"wins": wins, "podiums": podiums, "poles": poles, "starts": len(rows)}
        ranks = {
            key: 1 + sum(int(getattr(row, key) or 0) > value for row in aggregate_rows)
            for key, value in values.items()
            if value
        }
        highlights: list[FactCandidate] = []
        if championships:
            highlights.append(
                FactCandidate(
                    "championships",
                    "championship",
                    "",
                    100,
                    f"{championships}×",
                    "World champion",
                )
            )
        race = "Race" if include_sprint else "Grand Prix"
        for id_, value, label in (
            ("wins", wins, f"{race} {noun(wins, 'win')}"),
            ("podiums", podiums, noun(podiums, "Podium finish", "Podium finishes")),
            ("poles", poles, noun(poles, "Start from P1", "Starts from P1")),
            ("starts", len(rows), f"{race} {noun(len(rows), 'start')}"),
        ):
            if value:
                rank = ranks[id_]
                highlights.append(
                    FactCandidate(
                        id_,
                        "career",
                        "",
                        60,
                        str(value),
                        label,
                        DriverHighlightService._rank_sublabel(rank),
                    )
                )
        circuit_wins = Counter(
            row.event_name for row in rows if row.position == 1
        ).most_common(1)
        if circuit_wins and circuit_wins[0][1] >= 2:
            event, total = circuit_wins[0]
            highlights.append(
                FactCandidate(
                    "circuit_wins",
                    "circuit",
                    "",
                    55,
                    str(total),
                    f"{race} wins at {event}",
                )
            )
        constructor_wins = Counter(
            row.name for row in rows if row.position == 1
        ).most_common(1)
        if constructor_wins and constructor_wins[0][1] >= 2:
            name, total = constructor_wins[0]
            highlights.append(
                FactCandidate(
                    "constructor_wins",
                    "constructor",
                    "",
                    50,
                    str(total),
                    f"{race} wins with {name}",
                )
            )
        years = {row.year for row in rows}
        if years and max(years) - min(years) >= 10:
            highlights.append(
                FactCandidate(
                    "longevity",
                    "longevity",
                    "",
                    45,
                    str(max(years) - min(years) + 1),
                    "Seasons spanned",
                )
            )
        recoveries = [
            row.grid_position - row.position
            for row in rows
            if row.grid_position and row.grid_position > 0 and row.position
        ]
        if recoveries and max(recoveries) >= 10:
            highlights.append(
                FactCandidate(
                    "recovery",
                    "recovery",
                    "",
                    48,
                    str(max(recoveries)),
                    "Places gained in one Grand Prix",
                )
            )
        if len(driver.constructor_ids) >= 4:
            highlights.append(
                FactCandidate(
                    "constructors",
                    "constructor",
                    "",
                    42,
                    str(len(driver.constructor_ids)),
                    "Constructors driven for",
                )
            )
        longest_podium_run = 0
        podium_run = 0
        for row in rows:
            podium_run = podium_run + 1 if row.position in (1, 2, 3) else 0
            longest_podium_run = max(longest_podium_run, podium_run)
        if longest_podium_run >= 3:
            highlights.append(
                FactCandidate(
                    "podium_streak",
                    "streak",
                    "",
                    52,
                    str(longest_podium_run),
                    "Consecutive podium finishes",
                )
            )
        return highlights[:8]

    @staticmethod
    async def driver_page_superlatives(
        db: AsyncSession, driver_code: str, include_sprint: bool = True
    ) -> DriverSuperlativesResponse | None:
        driver = await DriverIdentityService.resolve(db, driver_code)
        if not driver:
            return None
        from app.services.driver_attribute_service import DriverAttributeService

        attributes = (await DriverAttributeService.derive(db, [driver.id])).get(
            driver.id
        )
        if not attributes:
            return DriverSuperlativesResponse(
                driver_code=driver.driver_code, superlatives=[]
            )
        highlights = await DriverHighlightService.highlights(
            db, attributes, include_sprint=include_sprint
        )
        return DriverSuperlativesResponse(
            driver_code=driver.driver_code,
            superlatives=[
                DriverSuperlative(
                    id=item.id,
                    value=item.value or "",
                    label=item.label or "",
                    category=item.category,
                    sublabel=item.sublabel,
                )
                for item in highlights
            ],
        )
