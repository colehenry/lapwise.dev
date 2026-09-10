"""Contract for the homepage ticker's candidate pool."""

from datetime import date as date_type
from typing import Literal

from pydantic import BaseModel


class HeadlineToken(BaseModel):
    """A span of `text` naming an entity, for the client to tint.

    Carries the code, never a colour: one palette, resolved from standings, has
    to govern the whole page.
    """

    start: int
    end: int
    kind: Literal["driver", "team"]
    code: str


class HeadlineValidity(BaseModel):
    """When a candidate stops being true enough to show.

    The pool is rebuilt from results rather than patched, so this tells a
    cached client how long the copy it holds can be trusted.
    """

    kind: Literal["next_race", "season_end", "date"]
    date: date_type | None = None


class Headline(BaseModel):
    """One claim about Formula 1 that the database can prove."""

    id: str
    category: str
    kicker: str
    text: str
    tokens: list[HeadlineToken] = []
    weight: float
    valid_until: HeadlineValidity
    href: str | None = None


class HeadlinesResponse(BaseModel):
    """Response for GET /api/headlines.

    The whole candidate pool. Selection, ordering and the daily shuffle run on
    the client; this endpoint only decides what is true.
    """

    season: int
    round: int | None
    headlines: list[Headline]
