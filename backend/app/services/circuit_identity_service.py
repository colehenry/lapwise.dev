"""Resolve canonical venues while retaining session-specific layout IDs."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Circuit, CircuitVenue, Session


@dataclass
class CircuitTarget:
    layout_id: int
    layout_ids: list[int]
    venue_slug: str
    venue_name: str


class CircuitIdentityService:
    @staticmethod
    async def resolve(db: AsyncSession, identifier: int | str) -> CircuitTarget | None:
        value = str(identifier)
        if value.isdigit():
            venue_id = await db.scalar(
                select(Circuit.venue_id).where(Circuit.id == int(value))
            )
        else:
            venue_id = await db.scalar(
                select(CircuitVenue.id).where(CircuitVenue.slug == value.lower())
            )
        if venue_id is None:
            return None
        venue = await db.get(CircuitVenue, venue_id)
        layout_ids = list(
            await db.scalars(select(Circuit.id).where(Circuit.venue_id == venue_id))
        )
        latest_layout = await db.scalar(
            select(Session.circuit_id)
            .where(Session.circuit_id.in_(layout_ids))
            .order_by(Session.date.desc())
            .limit(1)
        )
        return CircuitTarget(
            layout_id=latest_layout or layout_ids[0],
            layout_ids=layout_ids,
            venue_slug=venue.slug,
            venue_name=venue.canonical_name,
        )
