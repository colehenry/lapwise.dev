"""Loads every row the headline derivations read, in a fixed set of queries.

Half of the catalogue needs a driver's whole career, which is why this is a
service and not client work: in the browser it would be twenty-plus requests
before the ticker rendered its first word.
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AggConstructorCareer,
    AggDriverCareer,
    Circuit,
    Driver,
    Lap,
    Session,
    SessionResult,
    Team,
    TrackStatus,
    Weather,
)
from app.schemas.event import UpcomingEventResponse
from app.schemas.result import StandingsResponse
from app.services.canonical_standings_service import CanonicalStandingsService
from app.services.event_service import EventService
from app.services.results.common import sanitize_float

UPCOMING_LIMIT = 10

# FastF1 track status codes.
SAFETY_CAR = "4"
RED_FLAG = "5"


@dataclass(frozen=True)
class RaceEntry:
    """One driver's result in one race."""

    year: int
    round: int
    date: date
    driver_id: int
    driver_code: str | None
    full_name: str
    team_name: str
    position: int | None
    grid_position: int | None
    points: float
    status: str
    fastest_lap: bool
    time_seconds: float | None
    circuit_name: str


@dataclass(frozen=True)
class QualifyingEntry:
    """One driver's result in one qualifying session."""

    year: int
    round: int
    driver_id: int
    driver_code: str | None
    full_name: str
    team_name: str
    position: int | None
    q1: float | None
    q2: float | None
    q3: float | None

    @property
    def reached_q3(self) -> bool:
        return self.q3 is not None

    @property
    def out_in_q1(self) -> bool:
        return self.q1 is not None and self.q2 is None


@dataclass(frozen=True)
class RoundFacts:
    """Session-wide facts about one round, off the lap and status tables."""

    round: int
    lead_changes: int
    fastest_lap_seconds: float | None
    fastest_lap_code: str | None
    safety_cars: int
    red_flags: int
    max_track_temp: float | None
    most_laps_led_code: str | None
    most_laps_led: int
    laps_counted: int


@dataclass
class HeadlineContext:
    """Everything the derivations read. Nothing queries past this point."""

    season: int
    latest_round: int | None
    standings: StandingsResponse | None
    season_races: list[RaceEntry] = field(default_factory=list)
    career_races: list[RaceEntry] = field(default_factory=list)
    season_qualifying: list[QualifyingEntry] = field(default_factory=list)
    career_qualifying: list[QualifyingEntry] = field(default_factory=list)
    round_facts: dict[int, RoundFacts] = field(default_factory=dict)
    constructor_careers: dict[str, tuple[int, int]] = field(default_factory=dict)
    driver_careers: dict[int, tuple[int, int]] = field(default_factory=dict)
    team_one_twos: dict[str, list[tuple[int, int]]] = field(default_factory=dict)
    upcoming: list[UpcomingEventResponse] = field(default_factory=list)
    circuit_names: dict[int, str] = field(default_factory=dict)
    circuit_first_year: dict[str, int] = field(default_factory=dict)

    def rounds_ago(self, round_number: int | None) -> int:
        if round_number is None or self.latest_round is None:
            return 0
        return max(0, self.latest_round - round_number)

    def surname(self, full_name: str) -> str:
        """Surname only, unless two drivers this season share it."""
        last = full_name.split()[-1]
        return full_name if self._shared_surnames.get(last, 0) > 1 else last

    @property
    def _shared_surnames(self) -> dict[str, int]:
        if not hasattr(self, "_surname_counts"):
            names = {entry.full_name for entry in self.season_races}
            counts: dict[str, int] = {}
            for name in names:
                counts[name.split()[-1]] = counts.get(name.split()[-1], 0) + 1
            self._surname_counts = counts
        return self._surname_counts


def _race_entry(row) -> RaceEntry:
    return RaceEntry(
        year=row.year,
        round=row.round,
        date=row.date,
        driver_id=row.driver_id,
        driver_code=row.driver_code,
        full_name=row.full_name,
        team_name=row.team_name,
        position=row.position,
        grid_position=row.grid_position,
        points=sanitize_float(row.points) or 0.0,
        status=row.status,
        fastest_lap=bool(row.fastest_lap),
        time_seconds=sanitize_float(row.time_seconds),
        circuit_name=row.circuit_name,
    )


def _results_query(session_type: str):
    return (
        select(
            Session.year,
            Session.round,
            Session.date,
            SessionResult.driver_id,
            Driver.driver_code,
            Driver.full_name,
            Team.name.label("team_name"),
            SessionResult.position,
            SessionResult.grid_position,
            SessionResult.points,
            SessionResult.status,
            SessionResult.fastest_lap,
            SessionResult.time_seconds,
            SessionResult.q1_time_seconds,
            SessionResult.q2_time_seconds,
            SessionResult.q3_time_seconds,
            Circuit.name.label("circuit_name"),
        )
        .join(Session, Session.id == SessionResult.session_id)
        .join(Circuit, Circuit.id == Session.circuit_id)
        .join(Driver, Driver.id == SessionResult.driver_id)
        .join(Team, Team.id == SessionResult.team_id)
        .where(Session.session_type == session_type)
        .order_by(Session.date, Session.round, SessionResult.position)
    )


def _qualifying_entry(row) -> QualifyingEntry:
    return QualifyingEntry(
        year=row.year,
        round=row.round,
        driver_id=row.driver_id,
        driver_code=row.driver_code,
        full_name=row.full_name,
        team_name=row.team_name,
        position=row.position,
        q1=sanitize_float(row.q1_time_seconds),
        q2=sanitize_float(row.q2_time_seconds),
        q3=sanitize_float(row.q3_time_seconds),
    )


class HeadlineContextLoader:
    """Reads the pool's inputs. Sprints are excluded throughout.

    No headline in the catalogue names a sprint, and the catalogue's own rule
    is that sprints do not count toward wins, podiums, points streaks or starts
    unless one does.
    """

    @staticmethod
    async def load(db: AsyncSession, season: int) -> HeadlineContext:
        season_races = [
            _race_entry(row)
            for row in (
                await db.execute(_results_query("race").where(Session.year == season))
            ).all()
        ]
        latest_round = max((e.round for e in season_races), default=None)

        context = HeadlineContext(
            season=season,
            latest_round=latest_round,
            standings=await CanonicalStandingsService.get_season_standings(db, season),
            season_races=season_races,
        )
        if not season_races:
            return context

        driver_ids = {entry.driver_id for entry in season_races}
        context.career_races = [
            _race_entry(row)
            for row in (
                await db.execute(
                    _results_query("race").where(
                        SessionResult.driver_id.in_(driver_ids)
                    )
                )
            ).all()
        ]
        readable = await HeadlineContextLoader._readable_qualifying_rounds(db)
        qualifying_rows = (
            await db.execute(
                _results_query("qualifying").where(
                    SessionResult.driver_id.in_(driver_ids)
                )
            )
        ).all()
        career_qualifying = sorted(
            (
                entry
                for row in qualifying_rows
                if (entry := _qualifying_entry(row)) is not None
                and (entry.year, entry.round) in readable
            ),
            key=lambda entry: (entry.year, entry.round),
        )
        context.career_qualifying = career_qualifying
        context.season_qualifying = [q for q in career_qualifying if q.year == season]

        context.round_facts = await HeadlineContextLoader._round_facts(db, season)
        context.constructor_careers = await HeadlineContextLoader._constructors(db)
        context.driver_careers = await HeadlineContextLoader._drivers(db, driver_ids)
        context.team_one_twos = await HeadlineContextLoader._one_twos(db)
        context.upcoming = await EventService.get_upcoming_events(db, UPCOMING_LIMIT)
        context.circuit_names = await HeadlineContextLoader._circuit_names(db, season)
        context.circuit_first_year = await HeadlineContextLoader._first_years(db)
        return context

    @staticmethod
    async def _round_facts(db: AsyncSession, season: int) -> dict[int, RoundFacts]:
        """Lead changes, fastest laps, interventions and heat, per round."""
        rounds = {
            row.round: row.id
            for row in (
                await db.execute(
                    select(Session.id, Session.round)
                    .where(Session.year == season)
                    .where(Session.session_type == "race")
                )
            ).all()
        }
        if not rounds:
            return {}
        session_ids = list(rounds.values())
        by_round = {session_id: rnd for rnd, session_id in rounds.items()}

        leaders: dict[int, dict[int, str]] = {}
        fastest: dict[int, tuple[float, str | None]] = {}
        for row in (
            await db.execute(
                select(
                    Lap.session_id,
                    Lap.lap_number,
                    Lap.position,
                    Lap.lap_time_seconds,
                    Driver.driver_code,
                )
                .join(Driver, Driver.id == Lap.driver_id)
                .where(Lap.session_id.in_(session_ids))
                .where((Lap.position == 1) | (Lap.lap_time_seconds.is_not(None)))
            )
        ).all():
            rnd = by_round[row.session_id]
            if row.position == 1:
                leaders.setdefault(rnd, {})[row.lap_number] = row.driver_code
            if row.lap_time_seconds is not None:
                best = fastest.get(rnd)
                if best is None or row.lap_time_seconds < best[0]:
                    fastest[rnd] = (row.lap_time_seconds, row.driver_code)

        interventions: dict[int, dict[str, int]] = {}
        for row in (
            await db.execute(
                select(TrackStatus.session_id, TrackStatus.status, func.count())
                .where(TrackStatus.session_id.in_(session_ids))
                .where(TrackStatus.status.in_([SAFETY_CAR, RED_FLAG]))
                .group_by(TrackStatus.session_id, TrackStatus.status)
            )
        ).all():
            interventions.setdefault(by_round[row[0]], {})[row[1]] = row[2]

        temperatures = {
            by_round[row[0]]: sanitize_float(row[1])
            for row in (
                await db.execute(
                    select(Weather.session_id, func.max(Weather.track_temp))
                    .where(Weather.session_id.in_(session_ids))
                    .group_by(Weather.session_id)
                )
            ).all()
        }

        facts = {}
        for rnd in rounds:
            order = leaders.get(rnd, {})
            changes = 0
            previous = None
            for lap in sorted(order):
                if previous and order[lap] != previous:
                    changes += 1
                previous = order[lap]
            led: dict[str, int] = {}
            for code in order.values():
                if code:
                    led[code] = led.get(code, 0) + 1
            front = max(led.items(), key=lambda pair: pair[1]) if led else None
            best = fastest.get(rnd)
            facts[rnd] = RoundFacts(
                round=rnd,
                lead_changes=changes,
                fastest_lap_seconds=sanitize_float(best[0]) if best else None,
                fastest_lap_code=best[1] if best else None,
                safety_cars=interventions.get(rnd, {}).get(SAFETY_CAR, 0),
                red_flags=interventions.get(rnd, {}).get(RED_FLAG, 0),
                max_track_temp=temperatures.get(rnd),
                most_laps_led_code=front[0] if front else None,
                most_laps_led=front[1] if front else 0,
                laps_counted=len(order),
            )
        return facts

    @staticmethod
    async def _constructors(db: AsyncSession) -> dict[str, tuple[int, int]]:
        """Career wins and entries per team name, sprints excluded."""
        return {
            row.team_name: (row.total_wins, row.total_races)
            for row in (
                await db.execute(
                    select(
                        AggConstructorCareer.team_name,
                        AggConstructorCareer.total_wins,
                        AggConstructorCareer.total_races,
                    ).where(AggConstructorCareer.include_sprint.is_(False))
                )
            ).all()
        }

    @staticmethod
    async def _readable_qualifying_rounds(db: AsyncSession) -> set[tuple[int, int]]:
        """Rounds whose Q1/Q2/Q3 times actually segment the session.

        Outside the current season this data does not hold up: drivers knocked
        out in Q1 carry Q2 and Q3 times, so "reached Q3" and "out in Q1" cannot
        be read from it. A round counts only when each segment is strictly
        smaller than the one before, which is what a real session looks like.
        Rounds that fail are dropped rather than guessed at, and a run that
        would have to cross one is simply not claimable.
        """
        rows = (
            await db.execute(
                select(
                    Session.year,
                    Session.round,
                    func.count(SessionResult.q1_time_seconds).label("q1"),
                    func.count(SessionResult.q2_time_seconds).label("q2"),
                    func.count(SessionResult.q3_time_seconds).label("q3"),
                )
                .join(SessionResult, SessionResult.session_id == Session.id)
                .where(Session.session_type == "qualifying")
                .group_by(Session.year, Session.round)
            )
        ).all()
        return {(row.year, row.round) for row in rows if 0 < row.q3 < row.q2 < row.q1}

    @staticmethod
    async def _drivers(db: AsyncSession, driver_ids) -> dict[int, tuple[int, int]]:
        """Career starts and podiums per driver, from the canonical aggregate."""
        return {
            row.driver_id: (row.total_races, row.total_podiums)
            for row in (
                await db.execute(
                    select(
                        AggDriverCareer.driver_id,
                        AggDriverCareer.total_races,
                        AggDriverCareer.total_podiums,
                    )
                    .where(AggDriverCareer.include_sprint.is_(False))
                    .where(AggDriverCareer.driver_id.in_(driver_ids))
                )
            ).all()
        }

    @staticmethod
    async def _one_twos(db: AsyncSession) -> dict[str, list[tuple[int, int]]]:
        """Every round a team took both of the top two places.

        Read over all results rather than the current grid's, because a team's
        last one-two was very likely scored by drivers who have since left.
        """
        rows = (
            await db.execute(
                select(Session.year, Session.round, Team.name)
                .join(SessionResult, SessionResult.session_id == Session.id)
                .join(Team, Team.id == SessionResult.team_id)
                .where(Session.session_type == "race")
                .where(SessionResult.position.in_([1, 2]))
                .group_by(Session.year, Session.round, Team.name)
                .having(func.count() == 2)
            )
        ).all()
        found: dict[str, list[tuple[int, int]]] = {}
        for row in rows:
            found.setdefault(row.name, []).append((row.year, row.round))
        return found

    @staticmethod
    async def _circuit_names(db: AsyncSession, season: int) -> dict[int, str]:
        """The circuit each round of the season was run at."""
        return {
            row.round: row.name
            for row in (
                await db.execute(
                    select(Session.round, Circuit.name)
                    .join(Circuit, Circuit.id == Session.circuit_id)
                    .where(Session.year == season)
                    .where(Session.session_type == "race")
                )
            ).all()
        }

    @staticmethod
    async def _first_years(db: AsyncSession) -> dict[str, int]:
        """The first season each circuit hosted a race."""
        return {
            row.name: row.first_year
            for row in (
                await db.execute(
                    select(Circuit.name, func.min(Session.year).label("first_year"))
                    .join(Session, Session.circuit_id == Circuit.id)
                    .where(Session.session_type == "race")
                    .group_by(Circuit.name)
                )
            ).all()
        }
