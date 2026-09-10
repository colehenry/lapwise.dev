"""Weights, thresholds and copy helpers shared by every headline derivation.

The rule the whole catalogue obeys: a headline is a claim about Formula 1 that
the database can prove. Nothing here invents, rounds into a different fact, or
falls back when a derivation comes up empty — a candidate that cannot be proved
is dropped and the ticker is shorter that day.
"""

import re
from dataclasses import dataclass
from datetime import date as date_type
from urllib.parse import quote

from app.schemas.headlines import Headline, HeadlineToken, HeadlineValidity

# Base weight per category, from the catalogue. Teams and season shape share
# `records`: the catalogue lists nine bases for ten sections and `records` is
# the one that covers what is left.
CATEGORY_BASE = {
    "championship": 1.0,
    "last_race": 0.9,
    "firsts": 0.85,
    "streak": 0.7,
    "qualifying": 0.65,
    "run_ended": 0.9,
    "records": 0.6,
    "milestone": 0.55,
    "next_race": 1.0,
}

RARITY_CAREER_FIRST = 1.0
RARITY_SEASON = 0.7
RARITY_LEADS_COUNT = 0.5

# A fact about round 13 should not still be leading the ticker at round 18.
RECENCY_DECAY = 0.85

MIN_STREAK = 3
MIN_DROUGHT = 5
MIN_RUN_ENDED = 12
MIN_LEAD_MARGIN = 2

MAX_CANDIDATES = 40
MAX_KICKER = 22

NEXT_RACE = HeadlineValidity(kind="next_race")
SEASON_END = HeadlineValidity(kind="season_end")

# Race status is free text from the source feed, so classification is matched
# rather than enumerated: "Finished", "Lapped" and "+3 Laps" all took the flag.
_CLASSIFIED = re.compile(r"^(Finished|Lapped|\+\d+ Laps?)$")
_NON_STARTER = {"Did not start", "Withdrew", "Did not qualify"}


def finished(status: str) -> bool:
    """Took the chequered flag, lapped or not."""
    return bool(_CLASSIFIED.match(status or ""))


def started(status: str) -> bool:
    return (status or "") not in _NON_STARTER


def on_lead_lap(entry) -> bool:
    """The runner-up's `time_seconds` is a gap only if they were not lapped.

    A lapped finisher carries an absolute race time, which would read as a
    margin of several thousand seconds.
    """
    return entry.time_seconds is not None and (entry.status or "") == "Finished"


def retired(status: str) -> bool:
    """Started and did not finish."""
    return started(status) and not finished(status)


@dataclass(frozen=True)
class Ent:
    """A run of text naming a driver or a team, tinted at render."""

    text: str
    kind: str
    code: str


def driver(name: str, code: str | None) -> Ent | str:
    """A driver span, or plain text when the driver has no code to tint by."""
    return Ent(name, "driver", code) if code else name


def team(name: str) -> Ent:
    return Ent(name, "team", name)


def compose(*parts: "str | Ent | None") -> tuple[str, list[HeadlineToken]]:
    """Build the copy and the spans to tint in one pass, so they cannot drift."""
    text: list[str] = []
    tokens: list[HeadlineToken] = []
    cursor = 0
    for part in parts:
        if part is None:
            continue
        if isinstance(part, Ent):
            tokens.append(
                HeadlineToken(
                    start=cursor,
                    end=cursor + len(part.text),
                    kind=part.kind,
                    code=part.code,
                )
            )
            text.append(part.text)
            cursor += len(part.text)
        else:
            text.append(part)
            cursor += len(part)
    return "".join(text), tokens


def weight(category: str, rarity: float, rounds_ago: int = 0) -> float:
    """`base(category) × rarity × recency`, as the catalogue defines it."""
    decay = RECENCY_DECAY ** max(0, rounds_ago)
    return round(CATEGORY_BASE[category] * rarity * decay, 4)


def driver_href(code: str | None) -> str | None:
    return f"/drivers/{code}" if code else None


def team_href(name: str | None) -> str | None:
    return f"/constructors/{quote(name)}" if name else None


def until(day: date_type | None) -> HeadlineValidity:
    return HeadlineValidity(kind="date", date=day) if day else NEXT_RACE


def num(value: float) -> str:
    """A number as the data holds it — never rounded into a different fact."""
    if value != value or value in (float("inf"), float("-inf")):
        raise ValueError("a headline cannot state a number the data does not hold")
    if value == int(value):
        return f"{int(value):,}"
    return f"{value:,.3f}".rstrip("0").rstrip(".")


def apostrophe(name: str) -> str:
    """The possessive ending for a name already written out as a tinted span.

    `Mercedes'` and `Williams'`, `Hamilton's` — the convention the catalogue
    writes its own copy in.
    """
    return "'" if name.endswith("s") else "'s"


def ordinal(value: int) -> str:
    if 10 <= value % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")
    return f"{value:,}{suffix}"


def plural(count: int, singular: str, many: str | None = None) -> str:
    return singular if count == 1 else (many or f"{singular}s")


WORDS = {
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
}


def spell(count: int) -> str:
    """Small counts read better as words; large ones are the drama."""
    return WORDS.get(count, str(count))


def candidate(
    *,
    id: str,
    category: str,
    kicker: str,
    parts: tuple,
    rarity: float,
    rounds_ago: int = 0,
    valid_until: HeadlineValidity = NEXT_RACE,
    href: str | None = None,
) -> Headline:
    """One proved claim, with its tinted spans and its weight."""
    text, tokens = compose(*parts)
    return Headline(
        id=id,
        category=category,
        kicker=kicker[:MAX_KICKER],
        text=text,
        tokens=tokens,
        weight=weight(category, rarity, rounds_ago),
        valid_until=valid_until,
        href=href,
    )


def trailing_run(entries: list, test) -> int | None:
    """How far back a condition has held — or None if it ran off the data.

    A "first time in N races" claim needs the run to be ended by a real earlier
    occurrence. When the run reaches the start of the history instead, the
    number would be an artefact of how much data was loaded, and the honest
    answer is to make no claim at all.
    """
    count = 0
    for entry in reversed(entries):
        if not test(entry):
            return count
        count += 1
    return None
