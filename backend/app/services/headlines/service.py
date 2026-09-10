"""Assembles the ticker's candidate pool.

Selection, ordering and the daily shuffle are the client's job. This decides
only what is true, and drops anything it cannot prove.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.headlines import HeadlinesResponse
from app.services.headlines.championship import (
    championship,
    milestones,
    next_race,
    teams,
)
from app.services.headlines.common import CATEGORY_BASE, MAX_CANDIDATES
from app.services.headlines.context import HeadlineContextLoader
from app.services.headlines.qualifying import qualifying
from app.services.headlines.race import last_race, season_shape
from app.services.headlines.streaks import firsts, runs_ended, streaks

DERIVATIONS = (
    championship,
    last_race,
    streaks,
    firsts,
    qualifying,
    runs_ended,
    teams,
    season_shape,
    next_race,
    milestones,
)


class HeadlinesService:
    """The ticker's candidate pool for one season."""

    @staticmethod
    async def get_headlines(db: AsyncSession, season: int) -> HeadlinesResponse:
        context = await HeadlineContextLoader.load(db, season)

        pool = []
        for derive in DERIVATIONS:
            pool.extend(derive(context))

        # One id, one claim: a derivation reached from two directions must not
        # put the same sentence in the lane twice.
        unique = {headline.id: headline for headline in pool}

        return HeadlinesResponse(
            season=season,
            round=context.latest_round,
            headlines=_fill(list(unique.values())),
        )


def _fill(pool: list) -> list:
    """Trim to the cap while leaving every category something to offer.

    The client takes at most one headline per category, so a pool cut by weight
    alone would hand it a lane of nothing but qualifying. Categories are drawn
    from in turn, strongest first within each, until the cap is reached.
    """
    buckets: dict[str, list] = {}
    for headline in pool:
        buckets.setdefault(headline.category, []).append(headline)
    for candidates in buckets.values():
        candidates.sort(key=lambda h: (-h.weight, h.id))

    order = sorted(buckets, key=lambda name: -CATEGORY_BASE.get(name, 0))
    chosen: list = []
    while len(chosen) < MAX_CANDIDATES and any(buckets.values()):
        for name in order:
            if not buckets[name]:
                continue
            chosen.append(buckets[name].pop(0))
            if len(chosen) == MAX_CANDIDATES:
                break
    return sorted(chosen, key=lambda h: (-h.weight, h.id))
