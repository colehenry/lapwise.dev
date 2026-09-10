"""Championship state, teams and the next race — catalogue sections A, G and I."""

from datetime import date, datetime, timezone

from app.schemas.headlines import Headline
from app.services.headlines.common import (
    NEXT_RACE,
    RARITY_LEADS_COUNT,
    RARITY_SEASON,
    SEASON_END,
    apostrophe,
    candidate,
    driver,
    driver_href,
    num,
    ordinal,
    plural,
    spell,
    team,
    team_href,
)
from app.services.headlines.context import UPCOMING_LIMIT, HeadlineContext

# Career totals worth naming. A round number in the tens is not a milestone.
RACE_MILESTONES = (100, 150, 200, 250, 300, 350, 400, 450, 500)
PODIUM_MILESTONES = (50, 100, 150, 200, 250)
ENTRY_MILESTONES = (500, 1000, 1500, 2000, 2500, 3000)


def championship(context: HeadlineContext) -> list[Headline]:
    """Section A — the orienting fact the ticker opens with."""
    standings = context.standings
    if not standings or len(standings.drivers) < 2:
        return []

    drivers = standings.drivers
    teams = standings.constructors
    out: list[Headline] = []

    top = drivers[:3]
    parts: list = []
    for index, entry in enumerate(top):
        if index:
            parts.append(" · ")
        parts.append(driver(context.surname(entry.full_name), entry.driver_code))
        parts.append(f" {num(entry.total_points)}")
    out.append(
        candidate(
            id=f"championship.standings.{context.season}",
            category="championship",
            kicker="Drivers",
            parts=tuple(parts),
            rarity=RARITY_SEASON,
            valid_until=NEXT_RACE,
            href="/results",
        )
    )

    if len(teams) >= 2:
        margin = round(teams[0].total_points - teams[1].total_points, 3)
        if margin > 0:
            out.append(
                candidate(
                    id=f"championship.constructor_gap.{context.season}",
                    category="championship",
                    kicker="Constructors",
                    parts=(
                        team(teams[0].team_name),
                        " lead ",
                        team(teams[1].team_name),
                        f" by {num(margin)}",
                    ),
                    rarity=RARITY_SEASON,
                    href=team_href(teams[0].team_name),
                )
            )

    leader = drivers[0]
    # Counted from the race results rather than the standings, because the
    # standings' `wins` includes the sprint and the catalogue's rule is that
    # sprints do not count unless the headline says so.
    grand_prix_wins = sum(
        1
        for entry in context.season_races
        if entry.position == 1 and entry.driver_code == leader.driver_code
    )
    if grand_prix_wins and context.latest_round:
        out.append(
            candidate(
                id=f"championship.wins.{leader.driver_code}",
                category="championship",
                kicker="Wins",
                parts=(
                    driver(context.surname(leader.full_name), leader.driver_code),
                    f" has {grand_prix_wins} {plural(grand_prix_wins, 'win')} "
                    f"from {context.latest_round} rounds",
                ),
                rarity=RARITY_SEASON,
                href=driver_href(leader.driver_code),
            )
        )

    out.extend(_gap(context))
    return out


def _gap(context: HeadlineContext) -> list[Headline]:
    """The championship gap, always eligible, stated as the data holds it."""
    drivers = context.standings.drivers
    margin = round(drivers[0].total_points - drivers[1].total_points, 3)
    if margin <= 0:
        return []
    return [
        candidate(
            id=f"championship.driver_gap.{context.season}",
            category="championship",
            kicker="The gap",
            parts=(
                driver(context.surname(drivers[0].full_name), drivers[0].driver_code),
                " leads ",
                driver(context.surname(drivers[1].full_name), drivers[1].driver_code),
                f" by {num(margin)} points",
            ),
            rarity=RARITY_SEASON,
            href="/results",
        )
    ]


def teams(context: HeadlineContext) -> list[Headline]:
    """Section G — what the constructors have done, this season and ever."""
    out: list[Headline] = []
    rounds = context.latest_round
    if not rounds:
        return out

    winners = {
        entry.round: entry
        for entry in context.season_races
        if entry.position == 1 and entry.round is not None
    }
    by_team: dict[str, int] = {}
    for entry in winners.values():
        by_team[entry.team_name] = by_team.get(entry.team_name, 0) + 1

    for name, wins in by_team.items():
        if wins == rounds:
            out.append(
                candidate(
                    id=f"records.team_sweep.{name}",
                    category="records",
                    kicker="Every round",
                    parts=(
                        team(name),
                        f" have won all {rounds} rounds this season",
                    ),
                    rarity=RARITY_SEASON,
                    href=team_href(name),
                )
            )
        elif wins >= 2:
            out.append(
                candidate(
                    id=f"records.team_wins.{name}",
                    category="records",
                    kicker="Team wins",
                    parts=(team(name), f" have won {wins} of {rounds}"),
                    rarity=RARITY_SEASON,
                    href=team_href(name),
                )
            )

    out.extend(_career_wins(context, by_team))
    return out


def _career_wins(
    context: HeadlineContext, season_wins: dict[str, int]
) -> list[Headline]:
    """A team's all-time win count, but only on the round that moved it.

    The total stays true all season; as news it is only true once. Stating it
    at round 13 about a win at round 7 would read as something that just
    happened.
    """
    latest_winner = next(
        (
            entry.team_name
            for entry in context.season_races
            if entry.round == context.latest_round and entry.position == 1
        ),
        None,
    )
    if latest_winner is None:
        return []
    career = context.constructor_careers.get(latest_winner)
    if not career or not career[0]:
        return []
    first_this_season = season_wins.get(latest_winner) == 1
    suffix = ", and their first this season" if first_this_season else ""
    return [
        candidate(
            id=f"records.team_career_wins.{latest_winner}",
            category="records",
            kicker="All-time",
            parts=(
                team(latest_winner),
                f"{apostrophe(latest_winner)} {ordinal(career[0])} win{suffix}",
            ),
            rarity=RARITY_LEADS_COUNT,
            href=team_href(latest_winner),
        )
    ]


def milestones(context: HeadlineContext) -> list[Headline]:
    """Section J — a career total reached, or reached at the next round."""
    out: list[Headline] = []
    next_event = _next_race(context)
    names: dict[int, tuple[str, str | None]] = {
        entry.driver_id: (entry.full_name, entry.driver_code)
        for entry in context.season_races
    }

    for driver_id, (total, podium_total) in context.driver_careers.items():
        if driver_id not in names:
            continue
        full_name, code = names[driver_id]
        if next_event and total + 1 in RACE_MILESTONES:
            out.append(
                candidate(
                    id=f"milestone.starts.{code}",
                    category="milestone",
                    kicker="Milestone",
                    parts=(
                        driver(context.surname(full_name), code),
                        f" starts his {ordinal(total + 1)} Grand Prix at "
                        f"{next_event.location}",
                    ),
                    rarity=RARITY_LEADS_COUNT,
                    href=driver_href(code),
                )
            )
        if podium_total in PODIUM_MILESTONES and _podium_last_round(context, driver_id):
            out.append(
                candidate(
                    id=f"milestone.podiums.{code}",
                    category="milestone",
                    kicker="Milestone",
                    parts=(
                        driver(context.surname(full_name), code),
                        f"{apostrophe(context.surname(full_name))} "
                        f"{ordinal(podium_total)} podium",
                    ),
                    rarity=RARITY_LEADS_COUNT,
                    href=driver_href(code),
                )
            )

    out.extend(_entry_milestones(context))
    return out


def _podium_last_round(context: HeadlineContext, driver_id: int) -> bool:
    return any(
        entry.driver_id == driver_id
        and entry.round == context.latest_round
        and entry.year == context.season
        and entry.position is not None
        and entry.position <= 3
        for entry in context.season_races
    )


def _entry_milestones(context: HeadlineContext) -> list[Headline]:
    out = []
    active = {entry.team_name for entry in context.season_races}
    for name in sorted(active):
        career = context.constructor_careers.get(name)
        if not career:
            continue
        entries = career[1]
        if entries in ENTRY_MILESTONES:
            out.append(
                candidate(
                    id=f"milestone.entries.{name}",
                    category="milestone",
                    kicker="Milestone",
                    parts=(
                        team(name),
                        f"{apostrophe(name)} {ordinal(entries)} race entry",
                    ),
                    rarity=RARITY_LEADS_COUNT,
                    href=team_href(name),
                )
            )
    return out


def next_race(context: HeadlineContext) -> list[Headline]:
    """Section I — the fact that closes the lane."""
    event = _next_race(context)
    if event is None:
        return []

    out: list[Headline] = []
    days = (date.fromisoformat(event.event_date) - _today()).days
    when = "today" if days <= 0 else f"in {days} {plural(days, 'day')}"
    out.append(
        candidate(
            id=f"next_race.up_next.{event.event_date}",
            category="next_race",
            kicker="Next",
            parts=(f"{event.event_name} · {event.location} · {when}",),
            rarity=1.0,
            valid_until=NEXT_RACE,
            href="/results",
        )
    )

    circuit = event.circuit_name
    first_year = context.circuit_first_year.get(circuit) if circuit else None
    if circuit is None or first_year is None:
        out.append(
            candidate(
                id=f"next_race.debut.{event.event_date}",
                category="next_race",
                kicker="A first",
                parts=(f"First running at {event.location}",),
                rarity=1.0,
            )
        )
    else:
        out.extend(_circuit_history(context, circuit))

    # Rounds beyond the tenth are invisible to the schedule feed, so the count
    # is stated as a floor and the season is never given a length.
    remaining = len([e for e in context.upcoming if e.round_number])
    if remaining:
        # The feed caps at ten, so a full window is a floor, not a total.
        count = (
            f"At least {remaining}"
            if remaining >= UPCOMING_LIMIT
            else spell(remaining).capitalize()
        )
        out.append(
            candidate(
                id=f"next_race.remaining.{context.season}",
                category="next_race",
                kicker="Left to run",
                parts=(f"{count} {plural(remaining, 'round')} still to run",),
                rarity=RARITY_SEASON,
                valid_until=SEASON_END,
            )
        )
    return out


def _circuit_history(context: HeadlineContext, circuit: str) -> list[Headline]:
    """Who on this grid has won at the circuit the field is heading to."""
    wins: dict[int, int] = {}
    names: dict[int, tuple[str, str | None]] = {}
    for entry in context.career_races:
        if entry.position != 1 or entry.circuit_name != circuit:
            continue
        wins[entry.driver_id] = wins.get(entry.driver_id, 0) + 1
        names[entry.driver_id] = (entry.full_name, entry.driver_code)
    if not wins:
        return []

    best = max(wins.values())
    leaders = sorted(d for d, count in wins.items() if count == best)
    if best < 2:
        return []

    parts: list = []
    for index, driver_id in enumerate(leaders):
        if index:
            parts.append(" and " if index == len(leaders) - 1 else ", ")
        full_name, code = names[driver_id]
        parts.append(driver(context.surname(full_name), code))
    parts.append(f" {'have' if len(leaders) > 1 else 'has'} won at {circuit} ")
    parts.append(f"{spell(best)} times")
    return [
        candidate(
            id=f"next_race.circuit_wins.{circuit}",
            category="next_race",
            kicker="At this track",
            parts=tuple(parts),
            rarity=RARITY_LEADS_COUNT,
            href=driver_href(names[leaders[0]][1]) if len(leaders) == 1 else None,
        )
    ]


def _next_race(context: HeadlineContext):
    return next((e for e in context.upcoming if e.round_number), None)


def _today() -> date:
    return datetime.now(timezone.utc).date()
