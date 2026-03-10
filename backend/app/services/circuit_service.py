from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models import Circuit, Session, SessionResult, Driver, Team
from app.schemas.circuit import (
    CircuitResponse,
    CircuitListResponse,
    CircuitRaceResult,
    CircuitRaceHistoryResponse,
    CircuitStatDriver,
    CircuitStatisticsResponse,
)


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
    async def get_circuit_by_id(
        db: AsyncSession, circuit_id: int
    ) -> Optional[CircuitResponse]:
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

    @staticmethod
    async def get_circuit_race_history(
        db: AsyncSession, circuit_id: int
    ) -> Optional[CircuitRaceHistoryResponse]:
        """Get race winners at this circuit across all years."""
        # Get circuit name
        circuit = await db.execute(
            select(Circuit.id, Circuit.name).where(Circuit.id == circuit_id)
        )
        circuit_row = circuit.first()
        if not circuit_row:
            return None

        # Get all race winners at this circuit
        query = (
            select(
                Session.year,
                Session.round,
                Session.event_name,
                Driver.full_name.label("winner_name"),
                Driver.driver_code.label("winner_code"),
                Driver.jolpica_id.label("winner_jolpica_id"),
                Team.name.label("team_name"),
                Team.team_color,
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(Session.circuit_id == circuit_id)
            .where(Session.session_type == "race")
            .where(SessionResult.position == 1)
            .order_by(Session.year.desc())
        )
        result = await db.execute(query)
        rows = result.all()

        from app.services.results_service import _make_slug

        races = [
            CircuitRaceResult(
                year=row.year,
                round=row.round,
                race_name=row.event_name,
                winner_name=row.winner_name,
                winner_code=row.winner_code,
                winner_slug=_make_slug(row.winner_jolpica_id, row.winner_name),
                team_name=row.team_name,
                team_color=row.team_color,
            )
            for row in rows
        ]

        return CircuitRaceHistoryResponse(
            circuit_id=circuit_row.id,
            circuit_name=circuit_row.name,
            races=races,
        )

    @staticmethod
    async def get_circuit_statistics(
        db: AsyncSession, circuit_id: int
    ) -> Optional[CircuitStatisticsResponse]:
        """Get aggregated statistics for a circuit."""
        # Get circuit name
        circuit = await db.execute(
            select(Circuit.id, Circuit.name).where(Circuit.id == circuit_id)
        )
        circuit_row = circuit.first()
        if not circuit_row:
            return None

        # Base filter for races at this circuit
        base_filter = and_(
            Session.circuit_id == circuit_id,
            Session.session_type == "race",
        )

        from app.services.results_service import _make_slug

        # Most wins (P1)
        wins_query = (
            select(
                Driver.full_name.label("name"),
                Driver.driver_code.label("code"),
                Driver.jolpica_id,
                func.count().label("count"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(base_filter)
            .where(SessionResult.position == 1)
            .group_by(
                Driver.id, Driver.full_name, Driver.driver_code, Driver.jolpica_id
            )
            .order_by(func.count().desc())
            .limit(10)
        )
        wins_result = await db.execute(wins_query)
        most_wins = [
            CircuitStatDriver(
                name=r.name,
                code=r.code,
                slug=_make_slug(r.jolpica_id, r.name),
                count=r.count,
            )
            for r in wins_result.all()
        ]

        # Most poles (grid_position = 1 from qualifying — approximate using race grid)
        poles_query = (
            select(
                Driver.full_name.label("name"),
                Driver.driver_code.label("code"),
                Driver.jolpica_id,
                func.count().label("count"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(base_filter)
            .where(SessionResult.grid_position == 1)
            .group_by(
                Driver.id, Driver.full_name, Driver.driver_code, Driver.jolpica_id
            )
            .order_by(func.count().desc())
            .limit(10)
        )
        poles_result = await db.execute(poles_query)
        most_poles = [
            CircuitStatDriver(
                name=r.name,
                code=r.code,
                slug=_make_slug(r.jolpica_id, r.name),
                count=r.count,
            )
            for r in poles_result.all()
        ]

        # Most fastest laps
        fl_query = (
            select(
                Driver.full_name.label("name"),
                Driver.driver_code.label("code"),
                Driver.jolpica_id,
                func.count().label("count"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(base_filter)
            .where(SessionResult.fastest_lap.is_(True))
            .group_by(
                Driver.id, Driver.full_name, Driver.driver_code, Driver.jolpica_id
            )
            .order_by(func.count().desc())
            .limit(10)
        )
        fl_result = await db.execute(fl_query)
        most_fastest_laps = [
            CircuitStatDriver(
                name=r.name,
                code=r.code,
                slug=_make_slug(r.jolpica_id, r.name),
                count=r.count,
            )
            for r in fl_result.all()
        ]

        # Constructor wins
        constructor_wins_query = (
            select(
                Team.name.label("name"),
                Team.team_color.label("color"),
                func.count().label("count"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(base_filter)
            .where(SessionResult.position == 1)
            .group_by(Team.name, Team.team_color)
            .order_by(func.count().desc())
            .limit(10)
        )
        cw_result = await db.execute(constructor_wins_query)
        constructor_wins = [
            CircuitStatDriver(name=r.name, count=r.count, color=r.color)
            for r in cw_result.all()
        ]

        return CircuitStatisticsResponse(
            circuit_id=circuit_row.id,
            circuit_name=circuit_row.name,
            most_wins=most_wins,
            most_poles=most_poles,
            most_fastest_laps=most_fastest_laps,
            constructor_wins=constructor_wins,
        )
