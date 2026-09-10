"""Qualifying form — catalogue section E, plus its runs-ended mirror.

The streak that matters is reaching Q3. A Q1 exit is tracked too, but only as a
run ended: the length of the run is the fact, not the exit.
"""

from app.schemas.headlines import Headline
from app.services.headlines.common import (
    MIN_DROUGHT,
    MIN_LEAD_MARGIN,
    MIN_RUN_ENDED,
    MIN_STREAK,
    RARITY_LEADS_COUNT,
    RARITY_SEASON,
    candidate,
    driver,
    driver_href,
    plural,
    spell,
    team,
    team_href,
    trailing_run,
)
from app.services.headlines.context import HeadlineContext, QualifyingEntry

MIN_FRONT_ROW_RUN = 3


def _by_driver(entries: list[QualifyingEntry]) -> dict[int, list[QualifyingEntry]]:
    grouped: dict[int, list[QualifyingEntry]] = {}
    for entry in entries:
        grouped.setdefault(entry.driver_id, []).append(entry)
    for sessions in grouped.values():
        sessions.sort(key=lambda entry: (entry.year, entry.round))
    return grouped


def _trailing(sessions: list[QualifyingEntry], test) -> int:
    count = 0
    for entry in reversed(sessions):
        if not test(entry):
            break
        count += 1
    return count


def qualifying(context: HeadlineContext) -> list[Headline]:
    """Q3 streaks, Q3 droughts ended, and the season's qualifying leaders."""
    out: list[Headline] = []
    latest = context.latest_round
    careers = _by_driver(context.career_qualifying)

    for driver_id, sessions in careers.items():
        newest = sessions[-1]
        if newest.year != context.season or newest.round != latest:
            continue
        name = context.surname(newest.full_name)
        code = newest.driver_code
        season_runs = [s for s in sessions if s.year == context.season]

        if newest.reached_q3:
            out.extend(_q3_form(context, sessions, season_runs, name, code))
            out.extend(_q3_drought_broken(context, sessions, name, code))

        if newest.out_in_q1:
            run = trailing_run(sessions[:-1], lambda s: not s.out_in_q1)
            if run is not None and run >= MIN_RUN_ENDED:
                out.append(
                    candidate(
                        id=f"run_ended.q1.{code}",
                        category="run_ended",
                        kicker="Run ended",
                        parts=(
                            driver(name, code),
                            f" was out in Q1 for the first time in {run} races",
                        ),
                        rarity=RARITY_SEASON,
                        href=driver_href(code),
                    )
                )

    out.extend(_teammate_qualifying(context))
    out.extend(_front_rows(context))
    out.extend(_pole_conversion(context))
    out.extend(_poles(context))
    return out


def _q3_form(context, sessions, season_runs, name, code) -> list[Headline]:
    """Either a perfect season in Q3, or a live streak of reaching it."""
    if len(season_runs) >= MIN_STREAK and all(s.reached_q3 for s in season_runs):
        return [
            candidate(
                id=f"qualifying.q3_season.{code}",
                category="qualifying",
                kicker="Every round",
                parts=(
                    driver(name, code),
                    " has reached Q3 in every round this season",
                ),
                rarity=RARITY_SEASON,
                href=driver_href(code),
            )
        ]
    run = _trailing(sessions, lambda s: s.reached_q3)
    if run < MIN_STREAK:
        return []
    return [
        candidate(
            id=f"qualifying.q3_streak.{code}",
            category="qualifying",
            kicker="Into Q3",
            parts=(
                driver(name, code),
                f" has reached Q3 {spell(run)} rounds running",
            ),
            rarity=RARITY_SEASON,
            href=driver_href(code),
        )
    ]


def _q3_drought_broken(context, sessions, name, code) -> list[Headline]:
    """`Sainz has reached Q3 for the first time in 11 rounds` — the true gap."""
    history = sessions[:-1]
    previous = [index for index, entry in enumerate(history) if entry.reached_q3]
    if not previous:
        return []
    gap = len(history) - previous[-1] - 1
    if gap < MIN_DROUGHT:
        return []
    return [
        candidate(
            id=f"qualifying.q3_return.{code}",
            category="qualifying",
            kicker="Back in Q3",
            parts=(
                driver(name, code),
                f" has reached Q3 for the first time in {gap} {plural(gap, 'round')}",
            ),
            rarity=RARITY_SEASON,
            href=driver_href(code),
        )
    ]


def _teammate_qualifying(context: HeadlineContext) -> list[Headline]:
    """The season's head-to-head between two drivers in the same car."""
    by_round: dict[int, dict[str, list[QualifyingEntry]]] = {}
    for entry in context.season_qualifying:
        by_round.setdefault(entry.round, {}).setdefault(entry.team_name, []).append(
            entry
        )

    tallies: dict[str, dict[int, int]] = {}
    entries: dict[int, QualifyingEntry] = {}
    for teams in by_round.values():
        for name, pair in teams.items():
            if len(pair) != 2:
                continue
            ahead, behind = sorted(
                pair, key=lambda e: (e.position is None, e.position or 0)
            )
            if ahead.position is None:
                continue
            tally = tallies.setdefault(name, {})
            tally[ahead.driver_id] = tally.get(ahead.driver_id, 0) + 1
            tally.setdefault(behind.driver_id, 0)
            entries[ahead.driver_id] = ahead
            entries[behind.driver_id] = behind

    out = []
    for name, tally in tallies.items():
        if len(tally) != 2:
            continue
        (lead_id, lead), (chase_id, chase) = sorted(
            tally.items(), key=lambda pair: -pair[1]
        )
        # The catalogue's threshold for a "leads the count" claim. A 7-6 is a
        # dead heat with a round in it, not a driver leading a teammate.
        if lead - chase < MIN_LEAD_MARGIN:
            continue
        out.append(
            candidate(
                id=f"qualifying.h2h.{name}",
                category="qualifying",
                kicker="Head to head",
                parts=(
                    driver(
                        context.surname(entries[lead_id].full_name),
                        entries[lead_id].driver_code,
                    ),
                    " leads ",
                    driver(
                        context.surname(entries[chase_id].full_name),
                        entries[chase_id].driver_code,
                    ),
                    f" {lead}–{chase} in qualifying",
                ),
                rarity=RARITY_SEASON,
                href=team_href(name),
            )
        )
    return out


def _front_rows(context: HeadlineContext) -> list[Headline]:
    """Consecutive rounds a team has put a car on the front row."""
    rounds = sorted({entry.round for entry in context.season_qualifying}, reverse=True)
    front: dict[str, set[int]] = {}
    for entry in context.season_qualifying:
        if entry.position in (1, 2):
            front.setdefault(entry.team_name, set()).add(entry.round)

    out = []
    for name, hits in front.items():
        run = 0
        for rnd in rounds:
            if rnd not in hits:
                break
            run += 1
        if run < MIN_FRONT_ROW_RUN:
            continue
        out.append(
            candidate(
                id=f"qualifying.front_row.{name}",
                category="qualifying",
                kicker="Front row",
                parts=(
                    f"{spell(run).capitalize()} consecutive front-row starts for ",
                    team(name),
                ),
                rarity=RARITY_SEASON,
                href=team_href(name),
            )
        )
    return out


def _pole_conversion(context: HeadlineContext) -> list[Headline]:
    """How often pole has become a win this season."""
    poles = {
        entry.round: entry.driver_id
        for entry in context.season_qualifying
        if entry.position == 1
    }
    if not poles:
        return []
    winners = {
        entry.round: entry.driver_id
        for entry in context.season_races
        if entry.position == 1
    }
    converted = sum(
        1 for rnd, driver_id in poles.items() if winners.get(rnd) == driver_id
    )
    return [
        candidate(
            id=f"qualifying.pole_conversion.{context.season}",
            category="qualifying",
            kicker="From pole",
            parts=(
                f"Pole has converted to a win {spell(converted)} "
                f"{plural(converted, 'time')} from {len(poles)}",
            ),
            rarity=RARITY_SEASON,
        )
    ]


def _poles(context: HeadlineContext) -> list[Headline]:
    """Who has the most poles this season. A tie names everyone who shares it."""
    counts: dict[int, int] = {}
    entries: dict[int, QualifyingEntry] = {}
    for entry in context.season_qualifying:
        if entry.position == 1:
            counts[entry.driver_id] = counts.get(entry.driver_id, 0) + 1
            entries[entry.driver_id] = entry
    if not counts:
        return []

    best = max(counts.values())
    holders = sorted(
        (driver_id for driver_id, count in counts.items() if count == best),
        key=lambda driver_id: entries[driver_id].full_name,
    )
    runner_up = max((c for c in counts.values() if c < best), default=0)
    if len(holders) == 1 and best - runner_up < 2:
        return []

    parts: list = []
    for index, driver_id in enumerate(holders):
        if index:
            parts.append(" and " if index == len(holders) - 1 else ", ")
        parts.append(
            driver(
                context.surname(entries[driver_id].full_name),
                entries[driver_id].driver_code,
            )
        )
    lead_in = f"{spell(best).capitalize()} {plural(best, 'pole')} for "
    tail = ", more than anyone" if len(holders) == 1 else " — nobody else has more"
    return [
        candidate(
            id=f"qualifying.poles.{context.season}",
            category="qualifying",
            kicker="Poles",
            parts=(lead_in, *parts, tail),
            rarity=RARITY_LEADS_COUNT,
            href=driver_href(entries[holders[0]].driver_code)
            if len(holders) == 1
            else None,
        )
    ]
