"""Streaks, firsts, droughts and runs ended — catalogue sections C, D and F.

Every derivation here reads a driver's career in order, oldest first, and
sprints never appear in it. A streak below its threshold is not a streak and
the candidate is dropped rather than softened.
"""

from dataclasses import dataclass

from app.schemas.headlines import Headline
from app.services.headlines.common import (
    MIN_DROUGHT,
    MIN_RUN_ENDED,
    MIN_STREAK,
    RARITY_CAREER_FIRST,
    RARITY_SEASON,
    candidate,
    driver,
    driver_href,
    ordinal,
    plural,
    retired,
    spell,
    team,
    team_href,
    trailing_run,
)
from app.services.headlines.context import HeadlineContext, RaceEntry

# Below this a teammate run is ordinary; the catalogue's threshold is four.
MIN_TEAMMATE_RUN = 4

# The catalogue's threshold for "has finished every race this season".
MIN_FULL_SEASON = 8


@dataclass
class Career:
    """One driver's races, oldest first."""

    driver_id: int
    full_name: str
    driver_code: str | None
    entries: list[RaceEntry]

    @property
    def latest(self) -> RaceEntry:
        return self.entries[-1]


def careers(context: HeadlineContext) -> list[Career]:
    """Career histories for the drivers who started the most recent round."""
    current = {
        entry.driver_id
        for entry in context.season_races
        if entry.round == context.latest_round
    }
    grouped: dict[int, list[RaceEntry]] = {}
    for entry in context.career_races:
        if entry.driver_id in current:
            grouped.setdefault(entry.driver_id, []).append(entry)
    return [
        Career(
            driver_id=driver_id,
            full_name=entries[-1].full_name,
            driver_code=entries[-1].driver_code,
            entries=entries,
        )
        for driver_id, entries in grouped.items()
        if entries
    ]


def _trailing(entries: list[RaceEntry], test) -> int:
    """How many races back the condition has held without a break."""
    count = 0
    for entry in reversed(entries):
        if not test(entry):
            break
        count += 1
    return count


def _scored(entry: RaceEntry) -> bool:
    return entry.points > 0


def _won(entry: RaceEntry) -> bool:
    return entry.position == 1


def _podium(entry: RaceEntry) -> bool:
    return entry.position is not None and entry.position <= 3


def streaks(context: HeadlineContext) -> list[Headline]:
    """Section C — runs that are still alive after the most recent round."""
    out: list[Headline] = []
    points_streaks: list[tuple[int, Career]] = []

    for career in careers(context):
        name = context.surname(career.full_name)
        code = career.driver_code

        wins = _trailing(career.entries, _won)
        if wins >= MIN_STREAK:
            out.append(
                candidate(
                    id=f"streak.wins.{code}",
                    category="streak",
                    kicker=f"{spell(wins).capitalize()} in a row",
                    parts=(
                        driver(name, code),
                        f" has won the last {spell(wins)} rounds",
                    ),
                    rarity=RARITY_SEASON,
                    href=driver_href(code),
                )
            )

        podiums = _trailing(career.entries, _podium)
        if podiums >= MIN_STREAK and wins < podiums:
            out.append(
                candidate(
                    id=f"streak.podiums.{code}",
                    category="streak",
                    kicker="On the podium",
                    parts=(
                        driver(name, code),
                        f" has finished on the podium {spell(podiums)} rounds running",
                    ),
                    rarity=RARITY_SEASON,
                    href=driver_href(code),
                )
            )

        points = _trailing(career.entries, _scored)
        if points >= MIN_DROUGHT:
            points_streaks.append((points, career))
            out.append(
                candidate(
                    id=f"streak.points.{code}",
                    category="streak",
                    kicker="Scoring run",
                    parts=(
                        driver(name, code),
                        f" has scored in {points} consecutive races",
                    ),
                    rarity=RARITY_SEASON,
                    href=driver_href(code),
                )
            )

        out.extend(_finished_every_race(context, career))

    out.extend(_longest_points_streak(context, points_streaks))
    out.extend(_teammate_streaks(context))
    out.extend(_team_droughts(context))
    return out


def _finished_every_race(context: HeadlineContext, career: Career) -> list[Headline]:
    season = [e for e in career.entries if e.year == context.season]
    if len(season) < MIN_FULL_SEASON or any(retired(e.status) for e in season):
        return []
    return [
        candidate(
            id=f"streak.all_finishes.{career.driver_code}",
            category="streak",
            kicker="Every race",
            parts=(
                driver(context.surname(career.full_name), career.driver_code),
                " has finished every race this season",
            ),
            rarity=RARITY_SEASON,
            href=driver_href(career.driver_code),
        )
    ]


def _longest_points_streak(context: HeadlineContext, streaks_found) -> list[Headline]:
    """The grid's longest live scoring run. Ties name everyone who holds it."""
    if not streaks_found:
        return []
    best = max(count for count, _ in streaks_found)
    holders = sorted(
        (career for count, career in streaks_found if count == best),
        key=lambda career: career.full_name,
    )
    parts: list = []
    for index, career in enumerate(holders):
        if index:
            parts.append(" and " if index == len(holders) - 1 else ", ")
        parts.append(driver(context.surname(career.full_name), career.driver_code))
    parts.insert(0, "Longest current points streak on the grid: ")
    parts.append(f", {best}")
    return [
        candidate(
            id="streak.longest_points",
            category="streak",
            kicker="Longest run",
            parts=tuple(parts),
            rarity=0.5,
            href=driver_href(holders[0].driver_code) if len(holders) == 1 else None,
        )
    ]


def _teammate_streaks(context: HeadlineContext) -> list[Headline]:
    """Consecutive rounds a driver has finished ahead of their teammate.

    A round where the pairing cannot be read — a one-car entry, or both cars
    out — ends the run rather than being skipped over: a streak the data cannot
    follow is not a streak that can be claimed.
    """
    rounds = sorted({entry.round for entry in context.season_races}, reverse=True)
    outcomes: dict[int, dict[int, bool]] = {}
    entries_by_driver: dict[int, RaceEntry] = {}

    for rnd in rounds:
        pairs: dict[str, list[RaceEntry]] = {}
        for entry in context.season_races:
            if entry.round == rnd:
                pairs.setdefault(entry.team_name, []).append(entry)
                entries_by_driver.setdefault(entry.driver_id, entry)
        for pair in pairs.values():
            if len(pair) != 2:
                continue
            ahead, behind = sorted(
                pair, key=lambda e: (e.position is None, e.position or 0)
            )
            if ahead.position is None:
                continue
            outcomes.setdefault(rnd, {})[ahead.driver_id] = True
            outcomes.setdefault(rnd, {})[behind.driver_id] = False

    out = []
    for driver_id, entry in entries_by_driver.items():
        run = 0
        for rnd in rounds:
            if outcomes.get(rnd, {}).get(driver_id) is not True:
                break
            run += 1
        if run < MIN_TEAMMATE_RUN:
            continue
        out.append(
            candidate(
                id=f"streak.teammate.{entry.driver_code}",
                category="streak",
                kicker="Team battle",
                parts=(
                    driver(context.surname(entry.full_name), entry.driver_code),
                    f" has beaten his teammate in {spell(run)} straight races",
                ),
                rarity=RARITY_SEASON,
                href=driver_href(entry.driver_code),
            )
        )
    return out


def _team_droughts(context: HeadlineContext) -> list[Headline]:
    """A team that has not scored for at least the drought threshold."""
    rounds = sorted({entry.round for entry in context.season_races})
    if not rounds:
        return []
    scoring: dict[str, int] = {}
    for entry in context.season_races:
        if entry.points > 0:
            scoring[entry.team_name] = max(scoring.get(entry.team_name, 0), entry.round)

    out = []
    for name in sorted({entry.team_name for entry in context.season_races}):
        last = scoring.get(name)
        if last is None:
            continue
        gap = len([r for r in rounds if r > last])
        if gap < MIN_DROUGHT:
            continue
        out.append(
            candidate(
                id=f"streak.team_drought.{name}",
                category="streak",
                kicker="Dry spell",
                parts=(team(name), f" have not scored since round {last}"),
                rarity=RARITY_SEASON,
                href=team_href(name),
            )
        )
    return out


def firsts(context: HeadlineContext) -> list[Headline]:
    """Section D — the facts people repeat to each other."""
    out: list[Headline] = []
    for career in careers(context):
        latest = career.latest
        if latest.year != context.season or latest.round != context.latest_round:
            continue
        name = context.surname(career.full_name)
        code = career.driver_code
        history = career.entries[:-1]

        if _won(latest):
            out.extend(_first_or_gap(context, career, name, code, history, _won, "win"))
        if _podium(latest):
            out.extend(
                _first_or_gap(context, career, name, code, history, _podium, "podium")
            )
        if _scored(latest) and not any(_scored(entry) for entry in history):
            out.append(
                candidate(
                    id=f"firsts.points.{code}",
                    category="firsts",
                    kicker="First points",
                    parts=(
                        driver(name, code),
                        f" scores for the first time in his "
                        f"{ordinal(len(career.entries))} start",
                    ),
                    rarity=RARITY_CAREER_FIRST,
                    href=driver_href(code),
                )
            )
    return out


def _first_or_gap(context, career, name, code, history, test, noun) -> list[Headline]:
    """A career first, or the true length of the drought it ended."""
    previous = [index for index, entry in enumerate(history) if test(entry)]
    if not previous:
        return [
            candidate(
                id=f"firsts.{noun}.{code}",
                category="firsts",
                kicker=f"First {noun}",
                parts=(driver(name, code), f"'s first career {noun}"),
                rarity=RARITY_CAREER_FIRST,
                href=driver_href(code),
            )
        ]
    gap = len(history) - previous[-1] - 1
    if gap < MIN_DROUGHT:
        return []
    return [
        candidate(
            id=f"firsts.{noun}_drought.{code}",
            category="firsts",
            kicker="Drought over",
            parts=(
                driver(name, code),
                f"'s first {noun} in {gap} {plural(gap, 'race')}",
            ),
            rarity=RARITY_SEASON,
            href=driver_href(code),
        )
    ]


def runs_ended(context: HeadlineContext) -> list[Headline]:
    """Section F — a long good run broken in the round just run.

    The length of the run is the story, so the copy leads with it. A run that
    ended before the most recent round is history, not news, and is dropped
    outright rather than merely down-weighted.
    """
    out: list[Headline] = []
    for career in careers(context):
        latest = career.latest
        if latest.year != context.season or latest.round != context.latest_round:
            continue
        name = context.surname(career.full_name)
        code = career.driver_code
        history = career.entries[:-1]

        if not _scored(latest):
            run = trailing_run(history, _scored)
            if run is not None and run >= MIN_RUN_ENDED:
                out.append(
                    candidate(
                        id=f"run_ended.points.{code}",
                        category="run_ended",
                        kicker="Run ended",
                        parts=(
                            driver(name, code),
                            f" finishes outside the points for the first time "
                            f"in {run} races",
                        ),
                        rarity=RARITY_SEASON,
                        href=driver_href(code),
                    )
                )
        if not _podium(latest):
            run = trailing_run(history, _podium)
            if run is not None and run >= MIN_RUN_ENDED:
                out.append(
                    candidate(
                        id=f"run_ended.podium.{code}",
                        category="run_ended",
                        kicker="Run ended",
                        parts=(
                            driver(name, code),
                            f"'s first non-podium in {run} rounds",
                        ),
                        rarity=RARITY_SEASON,
                        href=driver_href(code),
                    )
                )
        if retired(latest.status):
            run = trailing_run(history, lambda entry: not retired(entry.status))
            if run is not None and run >= MIN_RUN_ENDED:
                out.append(
                    candidate(
                        id=f"run_ended.retirement.{code}",
                        category="run_ended",
                        kicker="Run ended",
                        parts=(
                            driver(name, code),
                            f" retires for the first time in {run} races",
                        ),
                        rarity=RARITY_SEASON,
                        href=driver_href(code),
                    )
                )
    return out
