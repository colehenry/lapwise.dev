"""Shared candidate and variety rules for Guess Game scheduling."""

import random

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.driver_attribute_service import (
    DriverAttributes,
    DriverAttributeService,
)
from app.services.media_service import MediaService

ANSWER_LAST_RACED_FLOOR = 1990
ANSWER_MINIMUM_STARTS = 10
RECENT_VARIETY_WINDOW = 7


async def eligible_drivers(
    db: AsyncSession,
) -> tuple[list[DriverAttributes], int]:
    attributes = await DriverAttributeService.derive(db)
    media = await MediaService.resolve_many(db, list(attributes), None, "headshot")
    eligible = [
        item
        for item in attributes.values()
        if item.last_raced >= ANSWER_LAST_RACED_FLOOR
        and item.starts >= ANSWER_MINIMUM_STARTS
        and item.driver_id in media
    ]
    return eligible, len(attributes)


def variety_score(
    candidate: DriverAttributes, recent: list[dict]
) -> tuple[int, int, str]:
    penalties = 0
    for snapshot in recent[-RECENT_VARIETY_WINDOW:]:
        penalties += candidate.driver_slug == snapshot["driver_slug"]
        penalties += candidate.country_code == snapshot["country_code"]
        penalties += (
            candidate.signature_constructor.constructor_id
            == snapshot["constructor"]["id"]
        )
        penalties += candidate.career_peak == snapshot["career_peak"]
    return penalties, -candidate.starts, candidate.driver_slug


def choose_driver(
    eligible: list[DriverAttributes], recent: list[dict], rng: random.Random
) -> DriverAttributes:
    ordered = sorted(eligible, key=lambda item: variety_score(item, recent))
    best_penalty = variety_score(ordered[0], recent)[0]
    tied = [item for item in ordered if variety_score(item, recent)[0] == best_penalty]
    return rng.choice(tied[: min(12, len(tied))])
