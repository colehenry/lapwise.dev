"""The last race and the shape of the season — catalogue sections B and H."""

from app.schemas.headlines import Headline
from app.services.headlines.common import (
    RARITY_SEASON,
    SEASON_END,
    candidate,
    driver,
    driver_href,
    num,
    on_lead_lap,
    plural,
    retired,
    spell,
    team,
    team_href,
)
from app.services.headlines.context import HeadlineContext

# Below this a "gainer" is ordinary running, not a story.
MIN_PLACES_GAINED = 5


def _mmss(seconds: float) -> str:
    return f"{int(seconds // 60)}:{seconds % 60:06.3f}"


def last_race(context: HeadlineContext) -> list[Headline]:
    """Section B — what happened at the round just run."""
    rnd = context.latest_round
    if rnd is None:
        return []
    results = [entry for entry in context.season_races if entry.round == rnd]
    if not results:
        return []

    circuit = context.circuit_names.get(rnd, "")
    out: list[Headline] = []
    out.extend(_winner(context, results, circuit))
    out.extend(_gainer(context, results))
    out.extend(_fastest_lap(context, rnd))
    out.extend(_race_shape(context, results, rnd, circuit))
    out.extend(_laps_led(context, rnd, circuit))
    return out


def _winner(context: HeadlineContext, results, circuit: str) -> list[Headline]:
    winner = next((r for r in results if r.position == 1), None)
    second = next((r for r in results if r.position == 2), None)
    # A lapped runner-up carries an absolute time, not a gap, so there is no
    # margin to state.
    if winner is None or second is None or not on_lead_lap(second):
        return []
    return [
        candidate(
            id=f"last_race.win_margin.{context.season}.{winner.round}",
            category="last_race",
            kicker=circuit or "Last race",
            parts=(
                driver(context.surname(winner.full_name), winner.driver_code),
                f" wins by {num(round(second.time_seconds, 3))}s from ",
                driver(context.surname(second.full_name), second.driver_code),
            ),
            rarity=RARITY_SEASON,
            href=driver_href(winner.driver_code),
        )
    ]


def _gainer(context: HeadlineContext, results) -> list[Headline]:
    gains = [
        (entry.grid_position - entry.position, entry)
        for entry in results
        if entry.grid_position and entry.position
    ]
    if not gains:
        return []
    best, entry = max(gains, key=lambda pair: pair[0])
    if best < MIN_PLACES_GAINED:
        return []
    return [
        candidate(
            id=f"last_race.gainer.{entry.driver_code}.{entry.round}",
            category="last_race",
            kicker=f"From P{entry.grid_position}",
            parts=(
                driver(context.surname(entry.full_name), entry.driver_code),
                f" gained {best} places, P{entry.grid_position} → P{entry.position}",
            ),
            rarity=RARITY_SEASON,
            href=driver_href(entry.driver_code),
        )
    ]


def _fastest_lap(context: HeadlineContext, rnd: int) -> list[Headline]:
    facts = context.round_facts.get(rnd)
    if not facts or facts.fastest_lap_seconds is None:
        return []
    setter = next(
        (e for e in context.season_races if e.driver_code == facts.fastest_lap_code),
        None,
    )
    if setter is None:
        return []
    return [
        candidate(
            id=f"last_race.fastest_lap.{context.season}.{rnd}",
            category="last_race",
            kicker="Fastest lap",
            parts=(
                f"{_mmss(facts.fastest_lap_seconds)}, ",
                driver(context.surname(setter.full_name), setter.driver_code),
            ),
            rarity=RARITY_SEASON,
            href=driver_href(setter.driver_code),
        )
    ]


def _race_shape(context: HeadlineContext, results, rnd: int, circuit: str):
    facts = context.round_facts.get(rnd)
    out: list[Headline] = []

    if facts and facts.lead_changes >= 2:
        out.append(
            candidate(
                id=f"last_race.lead_changes.{context.season}.{rnd}",
                category="last_race",
                kicker="Lead changes",
                parts=(
                    f"{spell(facts.lead_changes).capitalize()} lead changes at {circuit}",
                ),
                rarity=RARITY_SEASON,
            )
        )

    retirements = sum(1 for entry in results if retired(entry.status))
    if retirements:
        out.append(
            candidate(
                id=f"last_race.retirements.{context.season}.{rnd}",
                category="last_race",
                kicker="Retirements",
                parts=(
                    f"{spell(retirements).capitalize()} "
                    f"{plural(retirements, 'car')} failed to finish at {circuit}",
                ),
                rarity=RARITY_SEASON,
            )
        )

    if facts and facts.red_flags:
        # Not "and restarted": the status table proves the flag, not what
        # followed it, and a race can be red-flagged and never resumed.
        out.append(
            candidate(
                id=f"last_race.red_flag.{context.season}.{rnd}",
                category="last_race",
                kicker="Red flag",
                parts=(f"{circuit} was red-flagged",),
                rarity=RARITY_SEASON,
            )
        )
    return out


def _laps_led(context: HeadlineContext, rnd: int, circuit: str) -> list[Headline]:
    """`Antonelli led 31 of 53 laps` — read off the per-lap position column."""
    facts = context.round_facts.get(rnd)
    if facts is None or not facts.laps_counted or facts.most_laps_led_code is None:
        return []
    code, laps, total = (
        facts.most_laps_led_code,
        facts.most_laps_led,
        facts.laps_counted,
    )
    entry = next((e for e in context.season_races if e.driver_code == code), None)
    if entry is None:
        return []
    return [
        candidate(
            id=f"last_race.laps_led.{code}.{rnd}",
            category="last_race",
            kicker="Out front",
            parts=(
                driver(context.surname(entry.full_name), code),
                f" led {laps} of {total} laps at {circuit}",
            ),
            rarity=RARITY_SEASON,
            href=driver_href(code),
        )
    ]


def season_shape(context: HeadlineContext) -> list[Headline]:
    """Section H — the season read whole, rather than round by round."""
    out: list[Headline] = []
    rounds = context.latest_round
    if not rounds:
        return out

    winners = {
        entry.driver_code
        for entry in context.season_races
        if entry.position == 1 and entry.driver_code
    }
    if len(winners) >= 2:
        out.append(
            candidate(
                id=f"records.winners.{context.season}",
                category="records",
                kicker="Winners",
                parts=(
                    f"{spell(len(winners)).capitalize()} different winners "
                    f"in {rounds} rounds",
                ),
                rarity=RARITY_SEASON,
                valid_until=SEASON_END,
            )
        )

    out.extend(_margins(context))
    out.extend(_interventions(context))
    out.extend(_heat(context))
    out.extend(_one_twos(context))
    return out


def _margins(context: HeadlineContext) -> list[Headline]:
    """Closest and largest winning margin of the season so far."""
    margins = [
        (entry.time_seconds, entry.round)
        for entry in context.season_races
        if entry.position == 2 and on_lead_lap(entry)
    ]
    if len(margins) < 2:
        return []
    closest = min(margins)
    largest = max(margins)
    return [
        candidate(
            id=f"records.closest.{context.season}",
            category="records",
            kicker="Closest",
            parts=(
                f"Closest finish of the season: {num(round(closest[0], 3))}s at "
                f"{context.circuit_names.get(closest[1], '')}",
            ),
            rarity=RARITY_SEASON,
            rounds_ago=context.rounds_ago(closest[1]),
            valid_until=SEASON_END,
        ),
        candidate(
            id=f"records.largest.{context.season}",
            category="records",
            kicker="Largest",
            parts=(
                f"Largest margin: {num(round(largest[0], 1))}s at "
                f"{context.circuit_names.get(largest[1], '')}",
            ),
            rarity=RARITY_SEASON,
            rounds_ago=context.rounds_ago(largest[1]),
            valid_until=SEASON_END,
        ),
    ]


def _interventions(context: HeadlineContext) -> list[Headline]:
    safety_cars = sum(f.safety_cars for f in context.round_facts.values())
    red_flags = sum(f.red_flags for f in context.round_facts.values())
    out = []
    if safety_cars:
        out.append(
            candidate(
                id=f"records.safety_cars.{context.season}",
                category="records",
                kicker="Safety cars",
                parts=(
                    f"{spell(safety_cars).capitalize()} safety "
                    f"{plural(safety_cars, 'car')} so far this season",
                ),
                rarity=RARITY_SEASON,
                valid_until=SEASON_END,
            )
        )
    if red_flags:
        out.append(
            candidate(
                id=f"records.red_flags.{context.season}",
                category="records",
                kicker="Red flags",
                parts=(
                    f"{spell(red_flags).capitalize()} red "
                    f"{plural(red_flags, 'flag')} this season",
                ),
                rarity=RARITY_SEASON,
                valid_until=SEASON_END,
            )
        )
    return out


def _heat(context: HeadlineContext) -> list[Headline]:
    temperatures = [
        (facts.max_track_temp, rnd)
        for rnd, facts in context.round_facts.items()
        if facts.max_track_temp is not None
    ]
    if not temperatures:
        return []
    hottest, rnd = max(temperatures)
    return [
        candidate(
            id=f"records.hottest.{context.season}",
            category="records",
            kicker="Hottest",
            parts=(
                f"Hottest race of the year: {round(hottest)}°C track at "
                f"{context.circuit_names.get(rnd, '')}",
            ),
            rarity=RARITY_SEASON,
            rounds_ago=context.rounds_ago(rnd),
            valid_until=SEASON_END,
        )
    ]


def _one_twos(context: HeadlineContext) -> list[Headline]:
    """A team taking both of the last round's top two places.

    Worth saying only when the run before it was long, and the gap is measured
    over every result ever — a team's last one-two was very likely scored by
    drivers who have since left the grid.
    """
    rnd = context.latest_round
    top_two = [
        entry
        for entry in context.season_races
        if entry.round == rnd and entry.position in (1, 2)
    ]
    if len(top_two) != 2 or top_two[0].team_name != top_two[1].team_name:
        return []

    name = top_two[0].team_name
    earlier = [
        year
        for year, round_number in context.team_one_twos.get(name, [])
        if (year, round_number) != (context.season, rnd)
    ]
    previous = max(earlier, default=None)
    if previous is not None and previous >= context.season:
        return []
    since = f" since {previous}" if previous is not None else ""
    return [
        candidate(
            id=f"records.one_two.{name}.{rnd}",
            category="records",
            kicker="One-two",
            parts=(team(name), f"'s first one-two{since}"),
            rarity=RARITY_SEASON,
            href=team_href(name),
        )
    ]
