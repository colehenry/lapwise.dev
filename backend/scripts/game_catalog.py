"""The set of headers a board may be built from.

A header is a category definition plus the predicate that resolves it. This
enumerates every header the shipped predicates can express against a given
eligibility pool, and drops the ones too shallow to intersect with anything.

Kept separate from the generator because the catalog is also what answers
"how many distinct headers exist", which is the constraint on a daily
schedule.
"""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session as OrmSession

from app.models import CircuitVenue, Constructor, Session
from app.nationality import PREFERRED_DEMONYM
from scripts.game_evidence import build_context
from scripts.game_predicates import Pool, resolve

# A header thinner than this cannot reliably reach three answers once it is
# intersected with anything, so it is not worth offering to the generator.
MIN_HEADER_DEPTH = 12

# Teammate headers are only interesting for drivers the player has heard of.
TEAMMATE_MIN_ENTRIES = 150

DECADES = (1980, 1990, 2000, 2010, 2020)


@dataclass(frozen=True)
class Header:
    id: str
    label: str
    prompt_label: str
    description: str
    visual: dict
    predicate: dict

    def as_category(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "prompt_label": self.prompt_label,
            "description": self.description,
            "visual": dict(self.visual),
            "predicate": dict(self.predicate),
        }

    @property
    def kind(self) -> str:
        return self.predicate["kind"]


def _text(value: str) -> dict:
    return {"kind": "text", "value": value}


def _constructor_headers(db: OrmSession) -> list[Header]:
    rows = db.execute(
        select(Constructor.slug, Constructor.canonical_name).order_by(Constructor.slug)
    ).all()
    return [
        Header(
            id=f"constructor-{slug}",
            label=name,
            prompt_label=f"{name} Driver",
            description=f"Entered a World Championship race for {name}",
            visual={"kind": "constructor", "value": name},
            predicate={"kind": "constructor", "value": slug, "version": 1},
        )
        for slug, name in rows
        if slug and name
    ]


def _nationality_headers() -> list[Header]:
    return [
        Header(
            id=f"nationality-{code.lower()}",
            label=f"{demonym} driver",
            prompt_label=f"{demonym} Driver",
            description=f"Has canonical {demonym} sporting nationality",
            visual={"kind": "nationality", "value": code},
            predicate={"kind": "nationality", "value": code, "version": 1},
        )
        for code, demonym in sorted(PREFERRED_DEMONYM.items())
    ]


def _decade_headers() -> list[Header]:
    headers = []
    for decade in DECADES:
        headers.append(
            Header(
                id=f"raced-{decade}s",
                label=f"Raced in the {decade}s",
                prompt_label=f"Raced in the {decade}s",
                description=(
                    f"Appeared in a World Championship race from {decade}–{decade + 9}"
                ),
                visual=_text(f"Raced in the {decade}s"),
                predicate={"kind": "race_decade", "value": decade, "version": 1},
            )
        )
        headers.append(
            Header(
                id=f"debuted-{decade}s",
                label=f"Debuted in the {decade}s",
                prompt_label=f"Debuted in the {decade}s",
                description=(
                    f"First World Championship race fell in {decade}–{decade + 9}"
                ),
                visual=_text(f"Debuted in the {decade}s"),
                predicate={"kind": "debut_decade", "value": decade, "version": 1},
            )
        )
    return headers


def _achievement_headers() -> list[Header]:
    return [
        Header(
            id="race-winner",
            label="Race winner",
            prompt_label="Race Winner",
            description="Won a World Championship race",
            visual=_text("Race Winner"),
            predicate={"kind": "race_winner", "version": 1},
        ),
        Header(
            id="podium-finisher",
            label="Podium finisher",
            prompt_label="Podium Finisher",
            description="Finished in the top three of a World Championship race",
            visual=_text("Podium Finisher"),
            predicate={"kind": "podium", "version": 1},
        ),
        Header(
            id="won-from-p6-plus",
            label="Won from P6 or lower",
            prompt_label="Won from P6+",
            description="Won a World Championship race starting sixth or lower",
            visual=_text("Won from P6+"),
            predicate={"kind": "win_from_grid", "minimum": 6, "version": 1},
        ),
        Header(
            id="sprint-winner",
            label="Sprint winner",
            prompt_label="Sprint Winner",
            description="Won a Formula 1 sprint race",
            visual=_text("Sprint Winner"),
            predicate={"kind": "sprint_winner", "version": 1},
        ),
        Header(
            id="won-with-multiple-constructors",
            label="Won with 2+ constructors",
            prompt_label="Won with Multiple Constructors",
            description=(
                "Won World Championship races for at least two exact constructors"
            ),
            visual=_text("Won with 2+ Constructors"),
            predicate={"kind": "multi_constructor_winner", "minimum": 2, "version": 1},
        ),
        Header(
            id="race-entries-100",
            label="100+ race entries",
            prompt_label="100+ Race Entries",
            description="Entered at least 100 World Championship races",
            visual=_text("100+ Race Entries"),
            predicate={"kind": "race_entries", "minimum": 100, "version": 1},
        ),
        Header(
            id="world-champion",
            label="World champion",
            prompt_label="World Champion",
            description="Won a Formula 1 Drivers' World Championship",
            visual=_text("World Champion"),
            predicate={"kind": "world_champion", "version": 1},
        ),
    ]


# Deliberately not in the catalog. The `pole_sitter` predicate is implemented
# and correct, but qualifying positions do not exist before 1990 and cover only
# 45% of the 1990s and 75% of the 2000s. Offering the header would report Senna
# with a handful of poles and exclude drivers who genuinely took them, which is
# worse than not offering it. Restore it when qualifying results are backfilled.
POLE_SITTER_HEADER = Header(
    id="pole-sitter",
    label="Pole sitter",
    prompt_label="Pole Sitter",
    description="Qualified first for a World Championship race",
    visual=_text("Pole Sitter"),
    predicate={"kind": "pole_sitter", "version": 1},
)


def latest_complete_season(db: OrmSession) -> int:
    """The most recent season whose calendar is fully known.

    `sessions` holds rounds that have happened, so the current season is always
    partial. A defunct-venue category read against a partial calendar calls
    every venue later in the year defunct, which is the opposite of true.
    """
    counts = dict(
        db.execute(
            select(Session.year, func.count())
            .where(Session.session_type == "race")
            .group_by(Session.year)
            .order_by(Session.year)
        ).all()
    )
    if not counts:
        raise ValueError("no race sessions")
    years = sorted(counts)
    newest = years[-1]
    if len(years) > 1 and counts[newest] < counts[years[-2]]:
        return years[-2]
    return newest


def _venue_headers(db: OrmSession) -> list[Header]:
    rows = db.execute(
        select(CircuitVenue.slug, CircuitVenue.canonical_name).order_by(
            CircuitVenue.slug
        )
    ).all()
    return [
        Header(
            id=f"won-at-{slug}",
            label=f"Won at {name}",
            prompt_label=f"Won at {name}",
            description=f"Won a World Championship race at {name}, on any layout",
            visual=_text(f"Won at {name}"),
            predicate={"kind": "won_at_venue", "value": slug, "version": 1},
        )
        for slug, name in rows
        if slug and name
    ]


def defunct_venue_header(season: int) -> Header:
    """Raced somewhere the given season's calendar does not visit.

    The season is on the predicate rather than implied, because the answer set
    has to freeze with the board: a venue returning to the calendar must not
    change a puzzle already played.
    """
    return Header(
        id=f"raced-at-defunct-venue-{season}",
        label="Raced at a defunct venue",
        prompt_label="Raced at a Defunct Venue",
        description=(
            f"Raced at a venue absent from the {season} World Championship calendar"
        ),
        visual=_text("Raced at a Defunct Venue"),
        predicate={"kind": "defunct_venue", "season": season, "version": 1},
    )


def _teammate_headers(pool: Pool) -> list[Header]:
    return [
        Header(
            id=f"teammate-{slug}",
            label=f"Teammate of {facts.full_name}",
            prompt_label=f"Teammate of {facts.full_name}",
            description=(
                f"Shared an exact constructor with {facts.full_name} in the same race"
            ),
            visual=_text(f"Teammate of {facts.full_name}"),
            predicate={"kind": "named_teammate", "driver_slug": slug, "version": 1},
        )
        for slug, facts in sorted(pool.items())
        if len(facts.races) >= TEAMMATE_MIN_ENTRIES
    ]


def candidate_headers(
    db: OrmSession, pool: Pool, season: int | None = None
) -> list[Header]:
    """Every header the shipped predicates can express, unfiltered by depth."""
    headers = [
        *_constructor_headers(db),
        *_nationality_headers(),
        *_decade_headers(),
        *_achievement_headers(),
        *_venue_headers(db),
        *_teammate_headers(pool),
    ]
    headers.append(defunct_venue_header(season or latest_complete_season(db)))
    return headers


def build_catalog(
    db: OrmSession,
    pool: Pool,
    minimum_depth: int = MIN_HEADER_DEPTH,
    season: int | None = None,
) -> dict[str, tuple[Header, set[str]]]:
    """Usable headers and the drivers each resolves to.

    Resolution is done once here and reused for every proposal, because the
    generator will intersect the same headers thousands of times.
    """
    headers = candidate_headers(db, pool, season)
    context = build_context(db, [header.as_category() for header in headers])

    catalog = {}
    for header in headers:
        answers = resolve(header.predicate, pool, context)
        if len(answers) >= minimum_depth:
            catalog[header.id] = (header, answers)
    return catalog
