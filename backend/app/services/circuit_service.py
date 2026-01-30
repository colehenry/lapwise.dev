from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models import Circuit, Session
from app.schemas.circuit import CircuitResponse, CircuitListResponse


class CircuitService:
    """Service for circuit-related operations"""

    @staticmethod
    async def get_all_circuits(db: AsyncSession) -> CircuitListResponse:
        """
        Get all F1 circuits with statistics.
        """
        # Get all circuits with race count and date info
        circuits_query = (
            select(
                Circuit.id,
                Circuit.name,
                Circuit.location,
                Circuit.country,
                Circuit.track_length_km,
                Circuit.latitude,
                Circuit.longitude,
                func.count(Session.id).label("total_races"),
                func.min(Session.year).label("first_year"),
                func.max(Session.year).label("most_recent_year"),
                func.max(Session.date).label("most_recent_date"),
            )
            .join(Session, Circuit.id == Session.circuit_id)
            .where(Session.session_type == "race")
            .group_by(Circuit.id)
            .order_by(func.max(Session.date).desc())
        )

        results = await db.execute(circuits_query)
        circuits_data = results.all()

        circuits = [
            CircuitResponse(
                id=row.id,
                name=row.name,
                location=row.location,
                country=row.country,
                track_length_km=row.track_length_km,
                latitude=row.latitude,
                longitude=row.longitude,
                total_races=row.total_races,
                first_year=row.first_year,
                most_recent_year=row.most_recent_year,
            )
            for row in circuits_data
        ]

        return CircuitListResponse(circuits=circuits, total=len(circuits))

    @staticmethod
    async def get_circuit_by_id(db: AsyncSession, circuit_id: int) -> Optional[CircuitResponse]:
        """
        Get detailed information for a specific circuit.
        """
        circuit_query = (
            select(
                Circuit.id,
                Circuit.name,
                Circuit.location,
                Circuit.country,
                Circuit.track_length_km,
                Circuit.latitude,
                Circuit.longitude,
                func.count(Session.id).label("total_races"),
                func.min(Session.year).label("first_year"),
                func.max(Session.year).label("most_recent_year"),
            )
            .join(Session, Circuit.id == Session.circuit_id)
            .where(Circuit.id == circuit_id)
            .where(Session.session_type == "race")
            .group_by(Circuit.id)
        )

        result = await db.execute(circuit_query)
        circuit_data = result.first()

        if not circuit_data:
            return None

        return CircuitResponse(
            id=circuit_data.id,
            name=circuit_data.name,
            location=circuit_data.location,
            country=circuit_data.country,
            track_length_km=circuit_data.track_length_km,
            latitude=circuit_data.latitude,
            longitude=circuit_data.longitude,
            total_races=circuit_data.total_races,
            first_year=circuit_data.first_year,
            most_recent_year=circuit_data.most_recent_year,
        )
