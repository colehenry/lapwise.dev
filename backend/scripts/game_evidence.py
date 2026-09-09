"""Category evidence for daily grid boards.

A predicate returns evidence or nothing, never a bare boolean. Evidence carries
the resolved facts that prove a header — constructor years, a first win and its
race, an actual entry count — and the unsatisfied arm carries the driver's real
value so a near miss reads as a number rather than a cross.

Facts are loaded once per board and every kind is a pure function over them,
which keeps the category semantics testable without a database.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date as date_type
from typing import Any, Callable, Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from app.models import (
    Circuit,
    CircuitVenue,
    Constructor,
    Driver,
    DriverChampionshipStanding,
    Session,
    SessionResult,
    Team,
)

PODIUM_POSITIONS = (1, 2, 3)


@dataclass(frozen=True)
class RaceEntry:
    session_id: int
    year: int
    date: date_type
    event_name: str
    position: int | None
    grid_position: int | None
    team_id: int | None
    constructor_slug: str | None
    constructor_name: str | None
    # The canonical venue rather than the layout raced on, so a win on any
    # reviewed Silverstone layout satisfies "Won at Silverstone".
    venue_slug: str | None = None
    venue_name: str | None = None


@dataclass
class DriverFacts:
    driver_id: int
    slug: str
    full_name: str
    country_code: str | None
    races: list[RaceEntry] = field(default_factory=list)
    sprints: list[RaceEntry] = field(default_factory=list)
    # Qualifying is loaded separately because a pole is a qualifying result;
    # starting a race from the front row after a penalty is not one.
    qualifying: list[RaceEntry] = field(default_factory=list)
    champion_years: list[int] = field(default_factory=list)


def _year_spans(years: Iterable[int]) -> list[list[int]]:
    """Consecutive years collapsed into [start, end] pairs."""
    ordered = sorted(set(years))
    if not ordered:
        return []
    spans = [[ordered[0], ordered[0]]]
    for year in ordered[1:]:
        if year == spans[-1][1] + 1:
            spans[-1][1] = year
        else:
            spans.append([year, year])
    return spans


def _best_finish(races: Sequence[RaceEntry]) -> RaceEntry | None:
    finishes = [race for race in races if race.position is not None]
    if not finishes:
        return None
    return min(finishes, key=lambda race: (race.position, race.date))


def _race_ref(race: RaceEntry) -> dict[str, Any]:
    return {"year": race.year, "event": race.event_name}


def load_driver_facts(
    db: OrmSession, driver_ids: Sequence[int]
) -> dict[int, DriverFacts]:
    """Every race, sprint and qualifying entry for the given drivers, plus the
    titles they won, in one pass."""
    if not driver_ids:
        return {}

    constructors = {
        team_id: (slug, name)
        for team_id, slug, name in db.execute(
            select(Team.id, Constructor.slug, Constructor.canonical_name).join(
                Constructor, Constructor.id == Team.constructor_id
            )
        ).all()
    }

    facts = {
        driver.id: DriverFacts(
            driver_id=driver.id,
            slug=driver.slug,
            full_name=driver.full_name,
            country_code=driver.country_code,
        )
        for driver in db.execute(
            select(Driver).where(Driver.id.in_(driver_ids))
        ).scalars()
    }

    rows = db.execute(
        select(
            SessionResult.driver_id,
            SessionResult.position,
            SessionResult.grid_position,
            SessionResult.team_id,
            Session.id,
            Session.year,
            Session.date,
            Session.event_name,
            Session.session_type,
            CircuitVenue.slug.label("venue_slug"),
            CircuitVenue.canonical_name.label("venue_name"),
        )
        .join(Session, Session.id == SessionResult.session_id)
        # Outer joins: a session with no reviewed circuit still counts as a
        # race entry, it simply cannot answer a venue category.
        .outerjoin(Circuit, Circuit.id == Session.circuit_id)
        .outerjoin(CircuitVenue, CircuitVenue.id == Circuit.venue_id)
        .where(
            SessionResult.driver_id.in_(driver_ids),
            Session.session_type.in_(("race", "sprint_race", "qualifying")),
        )
        .order_by(Session.date)
    ).all()

    buckets = {
        "race": "races",
        "sprint_race": "sprints",
        "qualifying": "qualifying",
    }
    for row in rows:
        if row.driver_id not in facts:
            continue
        constructor_slug, constructor_name = constructors.get(row.team_id, (None, None))
        entry = RaceEntry(
            session_id=row.id,
            year=row.year,
            date=row.date,
            event_name=row.event_name,
            position=row.position,
            grid_position=row.grid_position,
            team_id=row.team_id,
            constructor_slug=constructor_slug,
            constructor_name=constructor_name,
            venue_slug=row.venue_slug,
            venue_name=row.venue_name,
        )
        getattr(facts[row.driver_id], buckets[row.session_type]).append(entry)

    for driver_id, year in db.execute(
        select(
            DriverChampionshipStanding.driver_id, DriverChampionshipStanding.year
        ).where(
            DriverChampionshipStanding.driver_id.in_(driver_ids),
            DriverChampionshipStanding.position == 1,
            DriverChampionshipStanding.is_final.is_(True),
        )
    ).all():
        if driver_id in facts:
            facts[driver_id].champion_years.append(year)
    for value in facts.values():
        value.champion_years.sort()

    return facts


def load_teammate_seats(db: OrmSession, driver_slug: str) -> set[tuple[int, int]]:
    """The (session, team) seats a named driver occupied, for teammate tests."""
    rows = db.execute(
        select(SessionResult.session_id, SessionResult.team_id)
        .join(Driver, Driver.id == SessionResult.driver_id)
        .join(Session, Session.id == SessionResult.session_id)
        .where(
            Driver.slug == driver_slug,
            Session.session_type.in_(("race", "sprint_race")),
            SessionResult.team_id.is_not(None),
        )
    ).all()
    return {(row.session_id, row.team_id) for row in rows}


# --- Category kinds -------------------------------------------------------
#
# Each builder returns the evidence payload for one driver against one
# category. `satisfied` is authoritative; the remaining keys are the facts the
# client formats. The unsatisfied arm is the same query with the predicate's
# filter dropped, reporting the driver's actual value.


def _constructor(facts: DriverFacts, predicate: dict, context: dict) -> dict[str, Any]:
    target = predicate["value"]
    # The unsatisfied arm has no entry to read the canonical name from, so it
    # resolves the slug rather than printing it.
    name = context.get("constructor_names", {}).get(target, target)
    entries = [race for race in facts.races if race.constructor_slug == target]
    if entries:
        return {
            "satisfied": True,
            "constructor": entries[0].constructor_name or name,
            "spans": _year_spans(race.year for race in entries),
            "entries": len(entries),
        }
    driven = Counter(
        race.constructor_name for race in facts.races if race.constructor_name
    )
    return {
        "satisfied": False,
        "constructor": name,
        "drove_for": [driven_name for driven_name, _count in driven.most_common(3)],
        "constructor_count": len(driven),
    }


def _nationality(facts: DriverFacts, predicate: dict, _: dict) -> dict[str, Any]:
    return {
        "satisfied": facts.country_code == predicate["value"],
        "country_code": facts.country_code,
        "required": predicate["value"],
    }


def _race_decade(facts: DriverFacts, predicate: dict, _: dict) -> dict[str, Any]:
    decade = predicate["value"]
    within = [race for race in facts.races if decade <= race.year <= decade + 9]
    if within:
        return {
            "satisfied": True,
            "decade": decade,
            "first_year": within[0].year,
            "last_year": within[-1].year,
            "entries": len(within),
        }
    return {
        "satisfied": False,
        "decade": decade,
        "career_first": facts.races[0].year if facts.races else None,
        "career_last": facts.races[-1].year if facts.races else None,
    }


def _debut_decade(facts: DriverFacts, predicate: dict, _: dict) -> dict[str, Any]:
    decade = predicate["value"]
    if not facts.races:
        return {"satisfied": False, "decade": decade, "debut_year": None}
    debut = facts.races[0]
    return {
        "satisfied": decade <= debut.year <= decade + 9,
        "decade": decade,
        "debut_year": debut.year,
        "debut_event": debut.event_name,
    }


def _race_entries(facts: DriverFacts, predicate: dict, _: dict) -> dict[str, Any]:
    minimum = predicate["minimum"]
    return {
        "satisfied": len(facts.races) >= minimum,
        "minimum": minimum,
        "entries": len(facts.races),
        "first_year": facts.races[0].year if facts.races else None,
        "last_year": facts.races[-1].year if facts.races else None,
    }


def _race_winner(facts: DriverFacts, _predicate: dict, _: dict) -> dict[str, Any]:
    wins = [race for race in facts.races if race.position == 1]
    if wins:
        return {"satisfied": True, "wins": len(wins), "first_win": _race_ref(wins[0])}
    best = _best_finish(facts.races)
    return {
        "satisfied": False,
        "wins": 0,
        "best_finish": best.position if best else None,
        "best_finish_race": _race_ref(best) if best else None,
    }


def _podium(facts: DriverFacts, _predicate: dict, _: dict) -> dict[str, Any]:
    podiums = [race for race in facts.races if race.position in PODIUM_POSITIONS]
    if podiums:
        return {
            "satisfied": True,
            "podiums": len(podiums),
            "first_podium": _race_ref(podiums[0]),
        }
    best = _best_finish(facts.races)
    return {
        "satisfied": False,
        "podiums": 0,
        "best_finish": best.position if best else None,
        "best_finish_race": _race_ref(best) if best else None,
    }


def _win_from_grid(facts: DriverFacts, predicate: dict, _: dict) -> dict[str, Any]:
    minimum = predicate["minimum"]
    wins = [
        race
        for race in facts.races
        if race.position == 1 and race.grid_position is not None
    ]
    qualifying = [race for race in wins if race.grid_position >= minimum]
    if qualifying:
        deepest = max(qualifying, key=lambda race: race.grid_position)
        return {
            "satisfied": True,
            "minimum": minimum,
            "grid": deepest.grid_position,
            "race": _race_ref(deepest),
        }
    if wins:
        # The nearest miss is the win from furthest back, which is the number
        # that shows how close the driver came to the header.
        nearest = max(wins, key=lambda race: race.grid_position)
        return {
            "satisfied": False,
            "minimum": minimum,
            "best_grid": nearest.grid_position,
            "race": _race_ref(nearest),
            "wins": len(wins),
        }
    return {"satisfied": False, "minimum": minimum, "best_grid": None, "wins": 0}


def _sprint_winner(facts: DriverFacts, _predicate: dict, _: dict) -> dict[str, Any]:
    wins = [race for race in facts.sprints if race.position == 1]
    if wins:
        return {
            "satisfied": True,
            "sprint_wins": len(wins),
            "first_win": _race_ref(wins[0]),
        }
    return {
        "satisfied": False,
        "sprint_wins": 0,
        "sprint_entries": len(facts.sprints),
    }


def _multi_constructor_winner(
    facts: DriverFacts, predicate: dict, _: dict
) -> dict[str, Any]:
    minimum = predicate.get("minimum", 2)
    first_wins: dict[str, RaceEntry] = {}
    for race in facts.races:
        if race.position != 1 or not race.constructor_name:
            continue
        first_wins.setdefault(race.constructor_name, race)
    winners = [
        {"constructor": name, "year": race.year} for name, race in first_wins.items()
    ]
    winners.sort(key=lambda item: item["year"])
    return {
        "satisfied": len(winners) >= minimum,
        "minimum": minimum,
        "won_for": winners,
    }


def _named_teammate(
    facts: DriverFacts, predicate: dict, context: dict
) -> dict[str, Any]:
    target = predicate["driver_slug"]
    teammate_name = context["driver_names"].get(target, target)
    if facts.slug == target:
        # A driver is not their own teammate, and sharing a seat with yourself
        # is what the naive session/team match would otherwise report.
        return {"satisfied": False, "teammate": teammate_name, "self_reference": True}

    seats: set[tuple[int, int]] = context["teammate_seats"][target]
    shared = [
        race
        for race in facts.races + facts.sprints
        if race.team_id is not None and (race.session_id, race.team_id) in seats
    ]
    if shared:
        constructors = sorted(
            {race.constructor_name for race in shared if race.constructor_name}
        )
        return {
            "satisfied": True,
            "teammate": teammate_name,
            "constructors": constructors,
            "spans": _year_spans(race.year for race in shared),
        }
    return {
        "satisfied": False,
        "teammate": teammate_name,
        "career_first": facts.races[0].year if facts.races else None,
        "career_last": facts.races[-1].year if facts.races else None,
    }


def _world_champion(facts: DriverFacts, _predicate: dict, _: dict) -> dict[str, Any]:
    if facts.champion_years:
        return {
            "satisfied": True,
            "titles": len(facts.champion_years),
            "years": list(facts.champion_years),
        }
    # The near miss is the teaching line: a runner-up reads as a number rather
    # than a cross.
    return {"satisfied": False, "titles": 0, "years": []}


def _pole_sitter(facts: DriverFacts, _predicate: dict, _: dict) -> dict[str, Any]:
    """Qualifying P1. A race-grid P1 inherited through a penalty is not a pole,
    which is why qualifying is loaded separately from the race result."""
    poles = [entry for entry in facts.qualifying if entry.position == 1]
    if poles:
        return {
            "satisfied": True,
            "poles": len(poles),
            "first_pole": _race_ref(poles[0]),
        }
    best = _best_finish(facts.qualifying)
    return {
        "satisfied": False,
        "poles": 0,
        "best_qualifying": best.position if best else None,
        "best_qualifying_race": _race_ref(best) if best else None,
    }


def _won_at_venue(facts: DriverFacts, predicate: dict, context: dict) -> dict[str, Any]:
    """A win at the canonical venue, on any of its reviewed layouts."""
    target = predicate["value"]
    name = context.get("venue_names", {}).get(target, target)
    wins = [
        race for race in facts.races if race.position == 1 and race.venue_slug == target
    ]
    if wins:
        return {
            "satisfied": True,
            "venue": wins[0].venue_name or name,
            "wins": len(wins),
            "first_win": _race_ref(wins[0]),
        }
    starts = [race for race in facts.races if race.venue_slug == target]
    best = _best_finish(starts)
    return {
        "satisfied": False,
        "venue": name,
        "wins": 0,
        "starts": len(starts),
        "best_finish": best.position if best else None,
    }


def _defunct_venue(
    facts: DriverFacts, predicate: dict, context: dict
) -> dict[str, Any]:
    """Raced at a venue absent from a named season's scheduled calendar.

    The season is carried on the predicate and its calendar is frozen with the
    board, so a venue returning to the schedule cannot invalidate an answer on
    a puzzle already played.
    """
    season = predicate["season"]
    active = context.get("active_venues", {}).get(season, set())
    raced = {
        race.venue_slug: race
        for race in facts.races
        if race.venue_slug and race.venue_slug not in active
    }
    if raced:
        ordered = sorted(raced.values(), key=lambda race: race.date)
        return {
            "satisfied": True,
            "season": season,
            "venues": [race.venue_name or race.venue_slug for race in ordered[:3]],
            "venue_count": len(raced),
            "first": _race_ref(ordered[0]),
        }
    return {
        "satisfied": False,
        "season": season,
        "venues": [],
        "venue_count": 0,
    }


BUILDERS: dict[str, Callable[[DriverFacts, dict, dict], dict[str, Any]]] = {
    "constructor": _constructor,
    "nationality": _nationality,
    "race_decade": _race_decade,
    "debut_decade": _debut_decade,
    "race_entries": _race_entries,
    "race_winner": _race_winner,
    "podium": _podium,
    "win_from_grid": _win_from_grid,
    "sprint_winner": _sprint_winner,
    "multi_constructor_winner": _multi_constructor_winner,
    "named_teammate": _named_teammate,
    "world_champion": _world_champion,
    "pole_sitter": _pole_sitter,
    "won_at_venue": _won_at_venue,
    "defunct_venue": _defunct_venue,
}


def build_evidence(
    facts: DriverFacts, predicate: dict, context: dict | None = None
) -> dict[str, Any] | None:
    """Evidence for one driver against one category, or None for an unknown
    kind. A missing kind degrades to the boolean floor at the call site."""
    builder = BUILDERS.get(predicate["kind"])
    if builder is None:
        return None
    payload = builder(facts, predicate, context or {})
    return {"kind": predicate["kind"], **payload}


def build_context(db: OrmSession, categories: Sequence[dict]) -> dict:
    """Lookups that span drivers rather than belonging to any one of them."""
    teammate_slugs = {
        category["predicate"]["driver_slug"]
        for category in categories
        if category["predicate"]["kind"] == "named_teammate"
    }
    names: dict[str, str] = {}
    if teammate_slugs:
        names = {
            slug: full_name
            for slug, full_name in db.execute(
                select(Driver.slug, Driver.full_name).where(
                    Driver.slug.in_(teammate_slugs)
                )
            ).all()
        }

    constructor_slugs = {
        category["predicate"]["value"]
        for category in categories
        if category["predicate"]["kind"] == "constructor"
    }
    constructor_names: dict[str, str] = {}
    if constructor_slugs:
        constructor_names = {
            slug: canonical_name
            for slug, canonical_name in db.execute(
                select(Constructor.slug, Constructor.canonical_name).where(
                    Constructor.slug.in_(constructor_slugs)
                )
            ).all()
        }

    venue_slugs = {
        category["predicate"]["value"]
        for category in categories
        if category["predicate"]["kind"] == "won_at_venue"
    }
    venue_names: dict[str, str] = {}
    if venue_slugs:
        venue_names = {
            slug: canonical_name
            for slug, canonical_name in db.execute(
                select(CircuitVenue.slug, CircuitVenue.canonical_name).where(
                    CircuitVenue.slug.in_(venue_slugs)
                )
            ).all()
        }

    # The full scheduled calendar for the season, future rounds included, so a
    # venue already dropped but still to be visited this year is not defunct.
    seasons = {
        category["predicate"]["season"]
        for category in categories
        if category["predicate"]["kind"] == "defunct_venue"
    }
    active_venues: dict[int, set[str]] = {}
    for season in seasons:
        active_venues[season] = {
            slug
            for slug in db.execute(
                select(CircuitVenue.slug)
                .join(Circuit, Circuit.venue_id == CircuitVenue.id)
                .join(Session, Session.circuit_id == Circuit.id)
                .where(Session.year == season, Session.session_type == "race")
                .distinct()
            ).scalars()
        }

    return {
        "teammate_seats": defaultdict(
            set, {slug: load_teammate_seats(db, slug) for slug in teammate_slugs}
        ),
        "driver_names": names,
        "constructor_names": constructor_names,
        "venue_names": venue_names,
        "active_venues": active_venues,
    }
