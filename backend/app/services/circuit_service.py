from typing import Optional

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Circuit, Driver, Session, SessionResult, Team
from app.models.lap import Lap
from app.models.weather import Weather
from app.schemas.circuit import (
    CircuitLapRecordsResponse,
    CircuitLapTimeTrendResponse,
    CircuitListResponse,
    CircuitRaceHistoryResponse,
    CircuitRaceResult,
    CircuitRecentRaceResponse,
    CircuitResponse,
    CircuitStatDriver,
    CircuitStatisticsResponse,
    CircuitTyreStatsResponse,
    CircuitWeatherProfileResponse,
    CompoundUsageEntry,
    LapRecordEntry,
    LapTimeTrendEntry,
    RecentRacePodiumEntry,
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

    @staticmethod
    async def get_lap_records(
        db: AsyncSession, circuit_id: int
    ) -> Optional[CircuitLapRecordsResponse]:
        """Get fastest race lap and qualifying lap records at a circuit."""
        circuit = await db.execute(
            select(Circuit.id, Circuit.name).where(Circuit.id == circuit_id)
        )
        circuit_row = circuit.first()
        if not circuit_row:
            return None

        from app.services.results_service import _make_slug

        # Fastest race lap from laps table
        race_lap_query = (
            select(
                Lap.lap_time_seconds,
                Driver.full_name,
                Driver.driver_code,
                Driver.jolpica_id,
                Team.name.label("team_name"),
                Team.team_color,
                Session.year,
            )
            .join(Session, Lap.session_id == Session.id)
            .join(Driver, Lap.driver_id == Driver.id)
            .join(
                SessionResult,
                and_(
                    SessionResult.session_id == Session.id,
                    SessionResult.driver_id == Driver.id,
                ),
            )
            .join(Team, SessionResult.team_id == Team.id)
            .where(Session.circuit_id == circuit_id)
            .where(Session.session_type == "race")
            .where(Lap.lap_time_seconds.isnot(None))
            .where(Lap.lap_time_seconds > 0)
            .where(Lap.is_accurate.is_(True))
            .order_by(Lap.lap_time_seconds.asc())
            .limit(1)
        )
        race_result = await db.execute(race_lap_query)
        race_row = race_result.first()

        fastest_race_lap = None
        if race_row:
            fastest_race_lap = LapRecordEntry(
                time_seconds=race_row.lap_time_seconds,
                driver_name=race_row.full_name,
                driver_code=race_row.driver_code,
                driver_slug=_make_slug(race_row.jolpica_id, race_row.full_name),
                team_name=race_row.team_name,
                team_color=race_row.team_color,
                year=race_row.year,
            )

        # Fastest qualifying lap from session_results (best of q1/q2/q3)
        q_best = func.least(
            SessionResult.q1_time_seconds,
            SessionResult.q2_time_seconds,
            SessionResult.q3_time_seconds,
        ).label("best_q_time")

        quali_query = (
            select(
                q_best,
                Driver.full_name,
                Driver.driver_code,
                Driver.jolpica_id,
                Team.name.label("team_name"),
                Team.team_color,
                Session.year,
            )
            .join(Session, SessionResult.session_id == Session.id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(Session.circuit_id == circuit_id)
            .where(Session.session_type == "qualifying")
            .where(q_best.isnot(None))
            .where(q_best > 0)
            .order_by(q_best.asc())
            .limit(1)
        )
        quali_result = await db.execute(quali_query)
        quali_row = quali_result.first()

        fastest_qualifying_lap = None
        if quali_row and quali_row.best_q_time:
            fastest_qualifying_lap = LapRecordEntry(
                time_seconds=quali_row.best_q_time,
                driver_name=quali_row.full_name,
                driver_code=quali_row.driver_code,
                driver_slug=_make_slug(quali_row.jolpica_id, quali_row.full_name),
                team_name=quali_row.team_name,
                team_color=quali_row.team_color,
                year=quali_row.year,
            )

        return CircuitLapRecordsResponse(
            circuit_id=circuit_row.id,
            circuit_name=circuit_row.name,
            fastest_race_lap=fastest_race_lap,
            fastest_qualifying_lap=fastest_qualifying_lap,
        )

    @staticmethod
    async def get_recent_race(
        db: AsyncSession, circuit_id: int
    ) -> Optional[CircuitRecentRaceResponse]:
        """Get the most recent race at a circuit with podium and conditions."""
        circuit = await db.execute(
            select(Circuit.id, Circuit.name).where(Circuit.id == circuit_id)
        )
        circuit_row = circuit.first()
        if not circuit_row:
            return None

        from app.services.results_service import _make_slug

        # Find most recent race session at this circuit
        session_query = (
            select(Session)
            .where(Session.circuit_id == circuit_id)
            .where(Session.session_type == "race")
            .order_by(Session.date.desc())
            .limit(1)
        )
        session_result = await db.execute(session_query)
        race_session = session_result.scalar_one_or_none()
        if not race_session:
            return None

        # Get podium (top 3)
        podium_query = (
            select(
                SessionResult.position,
                Driver.full_name,
                Driver.driver_code,
                Driver.jolpica_id,
                Team.name.label("team_name"),
                Team.team_color,
            )
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.session_id == race_session.id)
            .where(SessionResult.position.isnot(None))
            .where(SessionResult.position <= 3)
            .order_by(SessionResult.position.asc())
        )
        podium_result = await db.execute(podium_query)
        podium = [
            RecentRacePodiumEntry(
                position=r.position,
                driver_name=r.full_name,
                driver_code=r.driver_code,
                driver_slug=_make_slug(r.jolpica_id, r.full_name),
                team_name=r.team_name,
                team_color=r.team_color,
            )
            for r in podium_result.all()
        ]

        # Get fastest lap driver
        fl_query = (
            select(Driver.full_name, Lap.lap_time_seconds)
            .join(Session, Lap.session_id == Session.id)
            .join(Driver, Lap.driver_id == Driver.id)
            .where(Lap.session_id == race_session.id)
            .where(Lap.lap_time_seconds.isnot(None))
            .where(Lap.lap_time_seconds > 0)
            .where(Lap.is_accurate.is_(True))
            .order_by(Lap.lap_time_seconds.asc())
            .limit(1)
        )
        fl_result = await db.execute(fl_query)
        fl_row = fl_result.first()

        # Get weather summary for this race
        weather_query = select(
            func.avg(Weather.air_temp).label("avg_air"),
            func.avg(Weather.track_temp).label("avg_track"),
            func.max(case((Weather.rainfall.is_(True), 1), else_=0)).label("had_rain"),
        ).where(Weather.session_id == race_session.id)
        weather_result = await db.execute(weather_query)
        weather_row = weather_result.first()

        return CircuitRecentRaceResponse(
            circuit_id=circuit_row.id,
            circuit_name=circuit_row.name,
            year=race_session.year,
            round=race_session.round,
            event_name=race_session.event_name,
            date=str(race_session.date),
            podium=podium,
            fastest_lap_driver=fl_row.full_name if fl_row else None,
            fastest_lap_time=(fl_row.lap_time_seconds if fl_row else None),
            avg_air_temp=(
                round(weather_row.avg_air, 1)
                if weather_row and weather_row.avg_air
                else None
            ),
            avg_track_temp=(
                round(weather_row.avg_track, 1)
                if weather_row and weather_row.avg_track
                else None
            ),
            had_rainfall=(
                bool(weather_row.had_rain)
                if weather_row and weather_row.had_rain is not None
                else None
            ),
        )

    @staticmethod
    async def get_lap_time_trend(
        db: AsyncSession, circuit_id: int
    ) -> Optional[CircuitLapTimeTrendResponse]:
        """Get fastest lap per year at a circuit (from laps table)."""
        circuit = await db.execute(
            select(Circuit.id, Circuit.name).where(Circuit.id == circuit_id)
        )
        circuit_row = circuit.first()
        if not circuit_row:
            return None

        # Subquery: min lap time per session
        min_lap_subq = (
            select(
                Session.id.label("session_id"),
                Session.year,
                func.min(Lap.lap_time_seconds).label("min_time"),
            )
            .join(Lap, Lap.session_id == Session.id)
            .where(Session.circuit_id == circuit_id)
            .where(Session.session_type == "race")
            .where(Lap.lap_time_seconds.isnot(None))
            .where(Lap.lap_time_seconds > 0)
            .where(Lap.is_accurate.is_(True))
            .group_by(Session.id, Session.year)
            .subquery()
        )

        # Join back to get the driver who set it
        trend_query = (
            select(
                min_lap_subq.c.year,
                min_lap_subq.c.min_time.label("fastest_lap_seconds"),
                Driver.full_name.label("driver_name"),
                Driver.driver_code,
                Team.team_color,
            )
            .join(
                Lap,
                and_(
                    Lap.session_id == min_lap_subq.c.session_id,
                    Lap.lap_time_seconds == min_lap_subq.c.min_time,
                ),
            )
            .join(Driver, Lap.driver_id == Driver.id)
            .join(Session, Lap.session_id == Session.id)
            .join(
                SessionResult,
                and_(
                    SessionResult.session_id == Session.id,
                    SessionResult.driver_id == Driver.id,
                ),
            )
            .join(Team, SessionResult.team_id == Team.id)
            .order_by(min_lap_subq.c.year.asc())
        )
        result = await db.execute(trend_query)
        rows = result.all()

        # Deduplicate by year (keep first = fastest)
        seen_years = set()
        trend = []
        for r in rows:
            if r.year not in seen_years:
                seen_years.add(r.year)
                trend.append(
                    LapTimeTrendEntry(
                        year=r.year,
                        fastest_lap_seconds=r.fastest_lap_seconds,
                        driver_name=r.driver_name,
                        driver_code=r.driver_code,
                        team_color=r.team_color,
                    )
                )

        return CircuitLapTimeTrendResponse(
            circuit_id=circuit_row.id,
            circuit_name=circuit_row.name,
            trend=trend,
        )

    @staticmethod
    async def get_weather_profile(
        db: AsyncSession, circuit_id: int
    ) -> Optional[CircuitWeatherProfileResponse]:
        """Get aggregated weather profile across all races at a circuit."""
        circuit = await db.execute(
            select(Circuit.id, Circuit.name).where(Circuit.id == circuit_id)
        )
        circuit_row = circuit.first()
        if not circuit_row:
            return None

        # Get all race session IDs at this circuit
        race_sessions = (
            select(Session.id)
            .where(Session.circuit_id == circuit_id)
            .where(Session.session_type == "race")
            .subquery()
        )

        # Aggregate weather across all races
        weather_query = select(
            func.count(func.distinct(Weather.session_id)).label("races_with_weather"),
            func.avg(Weather.air_temp).label("avg_air_temp"),
            func.avg(Weather.track_temp).label("avg_track_temp"),
            func.avg(Weather.humidity).label("avg_humidity"),
            func.avg(Weather.wind_speed).label("avg_wind_speed"),
        ).where(Weather.session_id.in_(select(race_sessions.c.id)))
        result = await db.execute(weather_query)
        row = result.first()

        # Count wet races (sessions where rainfall was detected)
        wet_query = (
            select(func.count(func.distinct(Weather.session_id)))
            .where(Weather.session_id.in_(select(race_sessions.c.id)))
            .where(Weather.rainfall.is_(True))
        )
        wet_result = await db.execute(wet_query)
        wet_count = wet_result.scalar() or 0

        # Total races at this circuit
        total_query = (
            select(func.count(Session.id))
            .where(Session.circuit_id == circuit_id)
            .where(Session.session_type == "race")
        )
        total_result = await db.execute(total_query)
        total_races = total_result.scalar() or 0

        return CircuitWeatherProfileResponse(
            circuit_id=circuit_row.id,
            circuit_name=circuit_row.name,
            races_with_weather=row.races_with_weather if row else 0,
            avg_air_temp=(
                round(row.avg_air_temp, 1) if row and row.avg_air_temp else None
            ),
            avg_track_temp=(
                round(row.avg_track_temp, 1) if row and row.avg_track_temp else None
            ),
            avg_humidity=(
                round(row.avg_humidity, 1) if row and row.avg_humidity else None
            ),
            avg_wind_speed=(
                round(row.avg_wind_speed, 1) if row and row.avg_wind_speed else None
            ),
            wet_race_count=wet_count,
            total_races_checked=total_races,
        )

    @staticmethod
    async def get_tyre_stats(
        db: AsyncSession, circuit_id: int
    ) -> Optional[CircuitTyreStatsResponse]:
        """Get tyre compound usage breakdown at a circuit."""
        circuit = await db.execute(
            select(Circuit.id, Circuit.name).where(Circuit.id == circuit_id)
        )
        circuit_row = circuit.first()
        if not circuit_row:
            return None

        # Get race session IDs at this circuit
        race_sessions = (
            select(Session.id)
            .where(Session.circuit_id == circuit_id)
            .where(Session.session_type == "race")
            .subquery()
        )

        # Count races with lap data
        races_count_query = (
            select(func.count(func.distinct(Lap.session_id)))
            .where(Lap.session_id.in_(select(race_sessions.c.id)))
            .where(Lap.compound.isnot(None))
        )
        races_result = await db.execute(races_count_query)
        races_with_data = races_result.scalar() or 0

        if races_with_data == 0:
            return CircuitTyreStatsResponse(
                circuit_id=circuit_row.id,
                circuit_name=circuit_row.name,
                races_with_data=0,
                compounds=[],
            )

        # Compound usage: total laps and avg stint length
        compound_query = (
            select(
                Lap.compound,
                func.count().label("total_laps"),
            )
            .where(Lap.session_id.in_(select(race_sessions.c.id)))
            .where(Lap.compound.isnot(None))
            .where(Lap.lap_time_seconds.isnot(None))
            .group_by(Lap.compound)
            .order_by(func.count().desc())
        )
        compound_result = await db.execute(compound_query)
        compound_rows = compound_result.all()

        total_laps = sum(r.total_laps for r in compound_rows)

        # Get avg stint length per compound
        stint_query = (
            select(
                Lap.compound,
                func.count().label("laps_in_stint"),
            )
            .where(Lap.session_id.in_(select(race_sessions.c.id)))
            .where(Lap.compound.isnot(None))
            .where(Lap.stint.isnot(None))
            .group_by(Lap.session_id, Lap.driver_id, Lap.stint, Lap.compound)
        )
        stint_subq = stint_query.subquery()

        avg_stint_query = select(
            stint_subq.c.compound,
            func.avg(stint_subq.c.laps_in_stint).label("avg_stint"),
        ).group_by(stint_subq.c.compound)
        avg_stint_result = await db.execute(avg_stint_query)
        avg_stints = {r.compound: round(r.avg_stint, 1) for r in avg_stint_result.all()}

        compounds = [
            CompoundUsageEntry(
                compound=r.compound,
                total_laps=r.total_laps,
                avg_stint_length=avg_stints.get(r.compound),
                percentage=round(r.total_laps / total_laps * 100, 1)
                if total_laps > 0
                else 0,
            )
            for r in compound_rows
        ]

        return CircuitTyreStatsResponse(
            circuit_id=circuit_row.id,
            circuit_name=circuit_row.name,
            races_with_data=races_with_data,
            compounds=compounds,
        )
