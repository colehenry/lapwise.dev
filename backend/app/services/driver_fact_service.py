"""Database-proven facts and winner highlights for driver surfaces."""

import hashlib
import re
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

FACT_ALGORITHM_VERSION = 3

RANK_SUBLABEL_LIMIT = 50
BEST_CHAMPIONSHIP_FINISH_FLOOR = 6

_CLASSIFIED_LAPPED = re.compile(r"^\+\d+ Laps?$")
_CLASSIFIED_STATUS = frozenset({"Finished", "Lapped"})


def _noun(total: int, singular: str, plural: str | None = None) -> str:
    """The noun form that matches the tally."""
    return singular if total == 1 else (plural or f"{singular}s")


def _count(total: int, singular: str, plural: str | None = None) -> str:
    """Numbers travel with the noun form that matches them."""
    return f"{total} {_noun(total, singular, plural)}"


def _times(total: int) -> str:
    """Small tallies read as words, larger ones as digits."""
    return {1: "once", 2: "twice"}.get(total, f"{total} times")


def _possessive(name: str) -> str:
    """Names already ending in s take the bare apostrophe."""
    return f"{name}'" if name.endswith(("s", "S")) else f"{name}'s"


def _series(items: list[str]) -> str:
    """Comma-separated until the final item, which takes the conjunction."""
    if len(items) == 1:
        return items[0]
    return f"{', '.join(items[:-1])} and {items[-1]}"


def _reached_the_finish(status: str | None) -> bool:
    """Classified runners finished, were lapped, or trailed by whole laps."""
    if not status:
        return True
    return status in _CLASSIFIED_STATUS or bool(_CLASSIFIED_LAPPED.match(status))


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
                    SessionResult.status,
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
                f"{_count(len(rows), 'Grand Prix start')} across"
                f" {_count(len(seasons), 'season')}.",
                20,
            )
        )
        constructor_starts = Counter(row.constructor_name for row in rows)
        primary_constructor, primary_starts = constructor_starts.most_common(1)[0]
        if len(constructors) == 1:
            candidates.append(
                FactCandidate(
                    "constructors.only",
                    "constructors",
                    f"Every Grand Prix start for {primary_constructor}.",
                    30,
                )
            )
        else:
            candidates.append(
                FactCandidate(
                    "constructors.count",
                    "constructors",
                    f"Grand Prix starts for"
                    f" {_count(len(constructors), 'different constructor')}.",
                    35,
                )
            )
            candidates.append(
                FactCandidate(
                    "constructors.most_starts",
                    "constructors",
                    f"{_count(primary_starts, 'Grand Prix start')} for"
                    f" {primary_constructor}, the most for any constructor.",
                    30,
                )
            )

        candidates.extend(
            await DriverFactService._championship_facts(db, driver.driver_id)
        )

        finishes = [row.position for row in rows if row.position is not None]
        if finishes:
            best = min(finishes)
            count = finishes.count(best)
            candidates.append(
                FactCandidate(
                    "finish.best",
                    "finish",
                    f"Best Grand Prix finish P{best}, {_times(count)}.",
                    50 if best <= 3 else 28,
                )
            )

        front_row = sum(row.grid_position == 1 for row in rows)
        if front_row:
            candidates.append(
                FactCandidate(
                    "grid.front",
                    "grid",
                    f"{_count(front_row, 'Grand Prix start')} from P1 on the grid.",
                    52,
                )
            )

        retirements = sum(not _reached_the_finish(row.status) for row in rows)
        if retirements:
            candidates.append(
                FactCandidate(
                    "reliability.retirements",
                    "reliability",
                    f"{_count(retirements, 'retirement')} from"
                    f" {_count(len(rows), 'Grand Prix start')}.",
                    32,
                )
            )

        wins_by_season = Counter(row.year for row in rows if row.position == 1)
        if wins_by_season:
            best_year, best_year_wins = min(
                wins_by_season.items(), key=lambda item: (-item[1], item[0])
            )
            if best_year_wins >= 2:
                candidates.append(
                    FactCandidate(
                        "season.best",
                        "season",
                        f"{_count(best_year_wins, 'win')} in {best_year},"
                        " more than in any other season.",
                        62,
                    )
                )
            win_years = sorted(wins_by_season)
            drought = max(
                (
                    later - earlier - 1
                    for earlier, later in zip(win_years, win_years[1:])
                ),
                default=0,
            )
            if drought >= 2:
                candidates.append(
                    FactCandidate(
                        "drought.between_wins",
                        "drought",
                        f"{_count(drought, 'full season')} between Grand Prix wins.",
                        57,
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
            text = None
            if wins:
                text = f"{_count(wins, 'win')} at the {event}."
            elif podiums:
                text = f"{_count(podiums, 'podium')} at the {event}."
            if text:
                candidates.append(
                    FactCandidate("circuit.strongest", "circuit", text, 45)
                )

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
                        f"Gained {_count(gain, 'place')} to finish"
                        f" P{recovered.position} in the {recovered.year}"
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
                    f"First {label} at the {row.year} {row.event_name}.",
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
                    f"Returned after {_count(gap, 'complete season')} away"
                    " from Formula 1.",
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
                    f"{_count(weekends, 'race')} as {_possessive(name)} teammate.",
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
    async def _championship_facts(
        db: AsyncSession, driver_id: int
    ) -> list[FactCandidate]:
        standings = (
            await db.execute(
                select(
                    DriverChampionshipStanding.year,
                    DriverChampionshipStanding.position,
                )
                .where(
                    DriverChampionshipStanding.driver_id == driver_id,
                    DriverChampionshipStanding.is_final.is_(True),
                    DriverChampionshipStanding.position.is_not(None),
                )
                .order_by(DriverChampionshipStanding.year)
            )
        ).all()
        if not standings:
            return []
        titles = [str(row.year) for row in standings if row.position == 1]
        if titles:
            return [
                FactCandidate(
                    "championship.titles",
                    "championship",
                    f"World champion in {_series(titles)}.",
                    90,
                )
            ]
        best = min(row.position for row in standings)
        years = [str(row.year) for row in standings if row.position == best]
        if best == 2:
            return [
                FactCandidate(
                    "championship.runner_up",
                    "championship",
                    f"Championship runner-up in {_series(years)}.",
                    70,
                )
            ]
        if best > BEST_CHAMPIONSHIP_FINISH_FLOOR:
            return []
        return [
            FactCandidate(
                "championship.best_finish",
                "championship",
                f"Best championship finish P{best}, in {_series(years)}.",
                40,
            )
        ]

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
                f"{_count(teammate_weekends, 'race')} as the mystery driver's"
                " teammate.",
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
                f"{_count(shared_podiums, 'Grand Prix podium')} alongside the"
                " mystery driver.",
                95,
            )
        overlap = driver.constructor_ids & mystery.constructor_ids
        if overlap:
            return FactCandidate(
                "relationship.constructor",
                "relationship",
                "Shares a constructor with the mystery driver.",
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
                f"A winner of the {shared_win_events[0]}, as is the mystery driver.",
                80,
            )
        overlap_seasons = len(
            range(
                max(driver.debut, mystery.debut),
                min(driver.last_raced, mystery.last_raced) + 1,
            )
        )
        if overlap_seasons:
            return FactCandidate(
                "relationship.shared_era",
                "relationship",
                f"{_count(overlap_seasons, 'season')} on the grid alongside the"
                " mystery driver.",
                75,
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
            ("wins", wins, f"{race} {_noun(wins, 'win')}"),
            ("podiums", podiums, _noun(podiums, "Podium finish", "Podium finishes")),
            ("poles", poles, _noun(poles, "Start from P1", "Starts from P1")),
            ("starts", len(rows), f"{race} {_noun(len(rows), 'start')}"),
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
                        DriverFactService._rank_sublabel(rank),
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
