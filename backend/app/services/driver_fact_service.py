"""Database-proven facts and winner highlights for driver surfaces."""

import hashlib
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import (
    Constructor,
    Driver,
    DriverChampionshipStanding,
    Session,
    SessionResult,
    Team,
)
from app.schemas.driver import (
    DriverSuperlative,
    DriverSuperlativesResponse,
)
from app.services.driver_attribute_service import DriverAttributes
from app.services.driver_identity_service import DriverIdentityService

FACT_ALGORITHM_VERSION = 1


@dataclass(frozen=True)
class FactCandidate:
    id: str
    category: str
    text: str
    weight: int
    value: str | None = None
    label: str | None = None
    sublabel: str | None = None


class DriverFactService:
    """Build deterministic claims only from canonical database rows."""

    @staticmethod
    async def candidates(
        db: AsyncSession,
        driver: DriverAttributes,
        mystery: DriverAttributes | None = None,
    ) -> list[FactCandidate]:
        rows = (
            await db.execute(
                select(
                    Session.id.label("session_id"),
                    Session.year,
                    Session.round,
                    Session.event_name,
                    Session.date,
                    SessionResult.team_id,
                    SessionResult.position,
                    SessionResult.grid_position,
                    SessionResult.points,
                    Team.constructor_id,
                    Constructor.canonical_name.label("constructor_name"),
                )
                .join(SessionResult, SessionResult.session_id == Session.id)
                .join(Team, Team.id == SessionResult.team_id)
                .join(Constructor, Constructor.id == Team.constructor_id)
                .where(
                    Session.session_type == "race",
                    SessionResult.driver_id == driver.driver_id,
                )
                .order_by(Session.date, Session.round)
            )
        ).all()
        if not rows:
            return []
        candidates: list[FactCandidate] = []
        seasons = sorted({row.year for row in rows})
        constructors = {row.constructor_id for row in rows}
        candidates.append(
            FactCandidate(
                "career.starts",
                "career",
                f"Made {len(rows)} Grand Prix starts across {len(seasons)} seasons.",
                20,
            )
        )
        if len(constructors) > 1:
            candidates.append(
                FactCandidate(
                    "constructors.count",
                    "constructors",
                    f"Raced for {len(constructors)} canonical constructors.",
                    35,
                )
            )
        constructor_starts = Counter(row.constructor_name for row in rows)
        primary_constructor, primary_starts = constructor_starts.most_common(1)[0]
        candidates.append(
            FactCandidate(
                "constructor.most_starts",
                "constructors",
                f"Made the most starts for {primary_constructor}, with"
                f" {primary_starts} Grand Prix entries.",
                30,
            )
        )

        finishes = [row.position for row in rows if row.position is not None]
        if finishes:
            best = min(finishes)
            count = finishes.count(best)
            candidates.append(
                FactCandidate(
                    "finish.best",
                    "finish",
                    f"Best Grand Prix finish was P{best}, achieved {count}"
                    f" {'time' if count == 1 else 'times'}.",
                    50 if best <= 3 else 28,
                )
            )

        circuit_counts: dict[str, list[int | None]] = defaultdict(list)
        for row in rows:
            circuit_counts[row.event_name].append(row.position)
        strongest: tuple[int, str] | None = None
        for event, positions in circuit_counts.items():
            wins = positions.count(1)
            podiums = sum(position in (1, 2, 3) for position in positions)
            starts = len(positions)
            score = wins * 100 + podiums * 10 + starts
            if strongest is None or (score, event) > strongest:
                strongest = (score, event)
        if strongest:
            event = strongest[1]
            positions = circuit_counts[event]
            wins = positions.count(1)
            podiums = sum(position in (1, 2, 3) for position in positions)
            if wins:
                text = f"Won the {event} {wins} {'time' if wins == 1 else 'times'}."
            elif podiums:
                text = (
                    f"Finished on the {event} podium {podiums}"
                    f" {'time' if podiums == 1 else 'times'}."
                )
            else:
                text = f"Made {len(positions)} starts at the {event}."
            candidates.append(FactCandidate("circuit.strongest", "circuit", text, 45))

        recoveries = [
            (row.grid_position - row.position, row)
            for row in rows
            if row.grid_position and row.grid_position > 0 and row.position
        ]
        if recoveries:
            gain, recovered = max(recoveries, key=lambda item: item[0])
            if gain >= 5:
                candidates.append(
                    FactCandidate(
                        "recovery.biggest",
                        "recovery",
                        f"Gained {gain} places from grid to finish at the"
                        f" {recovered.event_name}.",
                        55,
                    )
                )

        milestones = [
            ("win", next((row for row in rows if row.position == 1), None), 65),
            (
                "podium",
                next((row for row in rows if row.position in (1, 2, 3)), None),
                55,
            ),
            ("points", next((row for row in rows if (row.points or 0) > 0), None), 45),
        ]
        milestone = next((item for item in milestones if item[1] is not None), None)
        if milestone:
            label, row, weight = milestone
            candidates.append(
                FactCandidate(
                    f"milestone.first_{label}",
                    "milestone",
                    f"Scored a first Grand Prix {label} at the {row.event_name}"
                    f" in {row.year}.",
                    weight,
                )
            )

        gaps = [later - earlier for earlier, later in zip(seasons, seasons[1:])]
        if gaps and max(gaps) > 1:
            gap = max(gaps) - 1
            candidates.append(
                FactCandidate(
                    "longevity.comeback",
                    "longevity",
                    f"Returned after {gap} complete"
                    f" {'season' if gap == 1 else 'seasons'} away from Formula 1.",
                    60,
                )
            )

        teammate = await DriverFactService._most_frequent_teammate(db, driver.driver_id)
        if teammate:
            name, weekends = teammate
            candidates.append(
                FactCandidate(
                    "teammate.most_shared_starts",
                    "teammate",
                    f"Shared a constructor most often with {name}, across"
                    f" {weekends} Grand Prix weekends.",
                    58,
                )
            )
        if mystery and mystery.driver_id != driver.driver_id:
            relation = await DriverFactService._mystery_relationship(
                db, driver, mystery
            )
            if relation:
                candidates.append(relation)
        return candidates

    @staticmethod
    async def _most_frequent_teammate(
        db: AsyncSession, driver_id: int
    ) -> tuple[str, int] | None:
        teammate_team = aliased(Team)
        mine = (
            select(
                SessionResult.session_id,
                Team.constructor_id.label("constructor_id"),
            )
            .join(Session, Session.id == SessionResult.session_id)
            .join(Team, Team.id == SessionResult.team_id)
            .where(
                SessionResult.driver_id == driver_id,
                Session.session_type == "race",
            )
            .subquery()
        )
        row = (
            await db.execute(
                select(Driver.full_name, func.count().label("weekends"))
                .join(SessionResult, SessionResult.driver_id == Driver.id)
                .join(Session, Session.id == SessionResult.session_id)
                .join(teammate_team, teammate_team.id == SessionResult.team_id)
                .join(
                    mine,
                    (mine.c.session_id == SessionResult.session_id)
                    & (mine.c.constructor_id == teammate_team.constructor_id),
                )
                .where(Driver.id != driver_id, Session.session_type == "race")
                .group_by(Driver.id, Driver.full_name)
                .order_by(func.count().desc(), Driver.slug)
                .limit(1)
            )
        ).one_or_none()
        return (row.full_name, int(row.weekends)) if row else None

    @staticmethod
    async def _mystery_relationship(
        db: AsyncSession, driver: DriverAttributes, mystery: DriverAttributes
    ) -> FactCandidate | None:
        rows = (
            await db.execute(
                select(
                    SessionResult.driver_id,
                    SessionResult.session_id,
                    SessionResult.position,
                    Session.event_name,
                    Team.constructor_id,
                )
                .join(Session, Session.id == SessionResult.session_id)
                .join(Team, Team.id == SessionResult.team_id)
                .where(
                    Session.session_type == "race",
                    SessionResult.driver_id.in_((driver.driver_id, mystery.driver_id)),
                )
            )
        ).all()
        driver_rows = [row for row in rows if row.driver_id == driver.driver_id]
        mystery_rows = [row for row in rows if row.driver_id == mystery.driver_id]
        mystery_by_session = {row.session_id: row for row in mystery_rows}
        teammate_weekends = sum(
            row.session_id in mystery_by_session
            and row.constructor_id == mystery_by_session[row.session_id].constructor_id
            for row in driver_rows
        )
        if teammate_weekends:
            return FactCandidate(
                "relationship.teammates",
                "relationship",
                f"Was an actual teammate of the mystery driver at {teammate_weekends}"
                f" Grand Prix weekends.",
                100,
            )
        shared_podiums = sum(
            row.position in (1, 2, 3)
            and row.session_id in mystery_by_session
            and mystery_by_session[row.session_id].position in (1, 2, 3)
            for row in driver_rows
        )
        if shared_podiums:
            return FactCandidate(
                "relationship.shared_podium",
                "relationship",
                f"Shared a Grand Prix podium with the mystery driver"
                f" {shared_podiums} {'time' if shared_podiums == 1 else 'times'}.",
                95,
            )
        overlap = driver.constructor_ids & mystery.constructor_ids
        if overlap:
            return FactCandidate(
                "relationship.constructor",
                "relationship",
                "Raced for one of the mystery driver's constructors, though not"
                " necessarily in the same season.",
                85,
            )
        driver_win_events = {row.event_name for row in driver_rows if row.position == 1}
        shared_win_events = sorted(
            driver_win_events
            & {row.event_name for row in mystery_rows if row.position == 1}
        )
        if shared_win_events:
            return FactCandidate(
                "relationship.shared_win_circuit",
                "relationship",
                f"Won at the {shared_win_events[0]}, a race also won by the"
                " mystery driver.",
                80,
            )
        return None

    @staticmethod
    def select_fact(
        candidates: Iterable[FactCandidate],
        puzzle_public_id: str,
        driver_id: int,
        recent_categories: Iterable[str] = (),
    ) -> FactCandidate:
        options = list(candidates)
        if not options:
            raise ValueError("driver has no provable fact")
        recent = set(recent_categories)
        fresh = [candidate for candidate in options if candidate.category not in recent]
        pool = fresh or options
        top_weight = max(item.weight for item in pool)
        strongest = [item for item in pool if item.weight == top_weight]
        seed = f"{puzzle_public_id}:{driver_id}".encode()
        index = int(hashlib.sha256(seed).hexdigest(), 16) % len(strongest)
        return sorted(strongest, key=lambda item: item.id)[index]

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
        for id_, value, label in (
            ("wins", wins, "Grand Prix wins"),
            ("podiums", podiums, "Podium finishes"),
            ("poles", poles, "Pole positions"),
            ("starts", len(rows), "Grand Prix starts"),
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
                        "all-time leader" if rank == 1 else f"#{rank} all-time",
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
                    f"Wins at {event}",
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
                    f"Wins with {name}",
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
                    "Year career span",
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
                    "Constructors represented",
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
        highlights = await DriverFactService.highlights(
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
