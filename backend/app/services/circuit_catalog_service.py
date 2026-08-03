"""Venue-level circuit list and profile queries."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Circuit, CircuitVenue, Session
from app.schemas.circuit import CircuitListResponse, CircuitResponse
from app.services.circuit_identity_service import CircuitIdentityService


class CircuitCatalogService:
    @staticmethod
    async def get_all(db: AsyncSession) -> CircuitListResponse:
        latest_layout = (
            select(
                Circuit.venue_id,
                Circuit.id,
                Circuit.layout_slug,
                Circuit.track_length_km,
                Circuit.latitude,
                Circuit.longitude,
            )
            .join(Session, Session.circuit_id == Circuit.id)
            .where(Session.session_type == "race")
            .distinct(Circuit.venue_id)
            .order_by(Circuit.venue_id, Session.date.desc(), Session.round.desc())
            .subquery()
        )
        venue_stats = (
            select(
                Circuit.venue_id.label("venue_id"),
                func.count(Session.id).label("total_races"),
                func.min(Session.year).label("first_year"),
                func.max(Session.year).label("most_recent_year"),
                func.max(Session.date).label("most_recent_date"),
            )
            .join(Session, Circuit.id == Session.circuit_id)
            .where(Session.session_type == "race")
            .group_by(Circuit.venue_id)
            .subquery()
        )
        rows = (
            await db.execute(
                select(
                    latest_layout.c.id,
                    CircuitVenue.slug.label("venue_slug"),
                    CircuitVenue.canonical_name.label("name"),
                    CircuitVenue.location,
                    CircuitVenue.country,
                    latest_layout.c.layout_slug,
                    latest_layout.c.track_length_km,
                    latest_layout.c.latitude,
                    latest_layout.c.longitude,
                    venue_stats.c.total_races,
                    venue_stats.c.first_year,
                    venue_stats.c.most_recent_year,
                )
                .join(latest_layout, latest_layout.c.venue_id == CircuitVenue.id)
                .join(venue_stats, venue_stats.c.venue_id == CircuitVenue.id)
                .order_by(venue_stats.c.most_recent_date.desc())
            )
        ).all()
        circuits = [CircuitResponse(**row._mapping) for row in rows]
        return CircuitListResponse(circuits=circuits, total=len(circuits))

    @staticmethod
    async def get_one(
        db: AsyncSession, identifier: int | str
    ) -> CircuitResponse | None:
        target = await CircuitIdentityService.resolve(db, identifier)
        if not target:
            return None
        layout = await db.get(Circuit, target.layout_id)
        stats = (
            await db.execute(
                select(
                    func.count(Session.id),
                    func.min(Session.year),
                    func.max(Session.year),
                ).where(
                    Session.circuit_id.in_(target.layout_ids),
                    Session.session_type == "race",
                )
            )
        ).first()
        if not layout or not stats or stats[1] is None:
            return None
        return CircuitResponse(
            id=layout.id,
            venue_slug=target.venue_slug,
            layout_slug=layout.layout_slug,
            name=target.venue_name,
            location=layout.location,
            country=layout.country,
            track_length_km=layout.track_length_km,
            latitude=layout.latitude,
            longitude=layout.longitude,
            total_races=int(stats[0]),
            first_year=int(stats[1]),
            most_recent_year=int(stats[2]),
        )
