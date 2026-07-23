"""Qualifying sessions service: per-round qualifying laps, sectors, details."""

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Driver,
    Lap,
    Session,
    SessionResult,
    Team,
)
from app.schemas.result import (
    CircuitInfo,
    DriverInfo,
    DriverLapTimesData,
    LapData,
    LapTimesResponse,
    QualifyingSectorComparison,
    QualifyingSectorResponse,
    SessionInfo,
    SessionResultDetail,
    SessionResultsResponse,
    TeamInfo,
)
from app.services.results.common import (
    _make_slug,
    headshot_fallback_expr,
    sanitize_float,
)


class QualifyingSessionsService:
    """Qualifying sessions service: per-round qualifying laps, sectors, details."""

    @staticmethod
    async def get_qualifying_lap_times(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[LapTimesResponse]:
        """
        Get lap-by-lap timing data for qualifying sessions.
        """
        session_query = (
            select(Session)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "qualifying")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        laps_query = (
            select(
                Lap.lap_number,
                Lap.lap_time_seconds,
                Lap.compound,
                Lap.tyre_life,
                Lap.stint,
                Lap.track_status,
                Lap.sector1_time_seconds,
                Lap.sector2_time_seconds,
                Lap.sector3_time_seconds,
                Lap.pit_in_time_seconds,
                Lap.pit_out_time_seconds,
                Lap.pit_duration_seconds,
                Lap.position,
                Lap.speed_st,
                Lap.speed_i1,
                Lap.speed_i2,
                Lap.speed_fl,
                Lap.fresh_tyre,
                Lap.is_personal_best,
                Lap.deleted,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                Team.team_color,
                SessionResult.position.label("final_position"),
            )
            .join(Driver, Lap.driver_id == Driver.id)
            .join(
                SessionResult,
                (SessionResult.session_id == Lap.session_id)
                & (SessionResult.driver_id == Lap.driver_id),
            )
            .join(Team, SessionResult.team_id == Team.id)
            .where(Lap.session_id == session.id)
            .order_by(SessionResult.position, Lap.lap_number)
        )

        laps_result = await db.execute(laps_query)
        lap_rows = laps_result.all()

        if not lap_rows:
            return None

        drivers_dict = {}
        for row in lap_rows:
            driver_code = row.driver_code

            if driver_code not in drivers_dict:
                drivers_dict[driver_code] = {
                    "driver_code": driver_code,
                    "driver_slug": _make_slug(row.jolpica_id, row.full_name),
                    "full_name": row.full_name,
                    "country_code": row.country_code,
                    "team_color": row.team_color,
                    "final_position": row.final_position,
                    "laps": [],
                }

            drivers_dict[driver_code]["laps"].append(
                LapData(
                    lap_number=row.lap_number,
                    lap_time_seconds=sanitize_float(row.lap_time_seconds),
                    compound=row.compound,
                    tyre_life=row.tyre_life,
                    stint=row.stint,
                    track_status=row.track_status,
                    sector1_time_seconds=sanitize_float(row.sector1_time_seconds),
                    sector2_time_seconds=sanitize_float(row.sector2_time_seconds),
                    sector3_time_seconds=sanitize_float(row.sector3_time_seconds),
                    pit_in_time_seconds=sanitize_float(row.pit_in_time_seconds),
                    pit_out_time_seconds=sanitize_float(row.pit_out_time_seconds),
                    pit_duration_seconds=sanitize_float(row.pit_duration_seconds),
                    position=row.position,
                    speed_st=sanitize_float(row.speed_st),
                    speed_i1=sanitize_float(row.speed_i1),
                    speed_i2=sanitize_float(row.speed_i2),
                    speed_fl=sanitize_float(row.speed_fl),
                    fresh_tyre=row.fresh_tyre,
                    is_personal_best=row.is_personal_best,
                    deleted=row.deleted,
                )
            )

        drivers = [DriverLapTimesData(**data) for data in drivers_dict.values()]

        return LapTimesResponse(
            year=season,
            round=round_num,
            event_name=session.event_name,
            total_laps=None,
            drivers=drivers,
            track_status_events=[],
        )

    @staticmethod
    async def get_qualifying_sector_comparison(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[QualifyingSectorResponse]:
        """
        Get best sector times per driver for qualifying.
        Returns aggregated best sectors across all qualifying laps.
        """
        session_query = (
            select(Session)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "qualifying")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get best sectors per driver across all qualifying laps
        query = (
            select(
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Team.team_color,
                SessionResult.headshot_url,
                func.min(Lap.sector1_time_seconds).label("best_sector1"),
                func.min(Lap.sector2_time_seconds).label("best_sector2"),
                func.min(Lap.sector3_time_seconds).label("best_sector3"),
                func.min(Lap.lap_time_seconds).label("best_lap_time"),
            )
            .join(Driver, Lap.driver_id == Driver.id)
            .join(
                SessionResult,
                (SessionResult.session_id == Lap.session_id)
                & (SessionResult.driver_id == Lap.driver_id),
            )
            .join(Team, SessionResult.team_id == Team.id)
            .where(Lap.session_id == session.id)
            .where(Lap.deleted.is_(False) | Lap.deleted.is_(None))
            .group_by(
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Team.team_color,
                SessionResult.headshot_url,
            )
            .order_by(func.min(Lap.lap_time_seconds))
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        sectors = [
            QualifyingSectorComparison(
                driver_code=row.driver_code,
                driver_slug=_make_slug(row.jolpica_id, row.full_name),
                full_name=row.full_name,
                team_color=row.team_color,
                headshot_url=row.headshot_url,
                best_sector1=sanitize_float(row.best_sector1),
                best_sector2=sanitize_float(row.best_sector2),
                best_sector3=sanitize_float(row.best_sector3),
                best_lap_time=sanitize_float(row.best_lap_time),
                q_session="Q",
            )
            for row in rows
        ]

        return QualifyingSectorResponse(
            year=season,
            round=round_num,
            event_name=session.event_name,
            sectors=sectors,
        )

    @staticmethod
    async def get_qualifying_details(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[SessionResultsResponse]:
        """
        Get full qualifying results for a specific round.
        """
        session_query = (
            select(Session)
            .options(selectinload(Session.circuit))
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "qualifying")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get all results for this qualifying session with driver/team info
        results_query = (
            select(
                SessionResult,
                Driver,
                Team,
                headshot_fallback_expr().label("headshot_url"),
            )
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.session_id == session.id)
            .order_by(SessionResult.position)
        )

        results = await db.execute(results_query)
        result_rows = results.all()

        circuit = session.circuit

        session_info = SessionInfo(
            id=session.id,
            year=session.year,
            round=session.round,
            session_type=session.session_type,
            event_name=session.event_name,
            date=session.date,
            circuit=CircuitInfo(
                id=circuit.id,
                name=circuit.name,
                location=circuit.location,
                country=circuit.country,
                track_length_km=circuit.track_length_km,
                track_map_url=f"/track-maps/{circuit.id}.png",
            ),
            highlights_video_id=getattr(session, "highlights_video_id", None),
        )

        session_results = [
            SessionResultDetail(
                position=result.SessionResult.position,
                status=result.SessionResult.status,
                headshot_url=result.headshot_url,
                driver=DriverInfo(
                    driver_number=result.Driver.driver_number,
                    driver_code=result.Driver.driver_code,
                    driver_slug=result.Driver.driver_slug,
                    full_name=result.Driver.full_name,
                    country_code=result.Driver.country_code,
                ),
                team=TeamInfo(
                    name=result.Team.name,
                    team_color=result.Team.team_color,
                ),
                grid_position=result.SessionResult.grid_position,
                points=sanitize_float(result.SessionResult.points),
                laps_completed=result.SessionResult.laps_completed,
                time_seconds=sanitize_float(result.SessionResult.time_seconds),
                fastest_lap=result.SessionResult.fastest_lap,
                q1_time_seconds=sanitize_float(result.SessionResult.q1_time_seconds),
                q2_time_seconds=sanitize_float(result.SessionResult.q2_time_seconds),
                q3_time_seconds=sanitize_float(result.SessionResult.q3_time_seconds),
            )
            for result in result_rows
        ]

        return SessionResultsResponse(session=session_info, results=session_results)

    @staticmethod
    async def get_sprint_qualifying_details(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[SessionResultsResponse]:
        """
        Get full sprint qualifying results for a specific round.
        """
        session_query = (
            select(Session)
            .options(selectinload(Session.circuit))
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "sprint_qualifying")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get all results for this sprint qualifying session with driver/team info
        results_query = (
            select(
                SessionResult,
                Driver,
                Team,
                headshot_fallback_expr().label("headshot_url"),
            )
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.session_id == session.id)
            .order_by(SessionResult.position)
        )

        results = await db.execute(results_query)
        result_rows = results.all()

        circuit = session.circuit

        session_info = SessionInfo(
            id=session.id,
            year=session.year,
            round=session.round,
            session_type=session.session_type,
            event_name=session.event_name,
            date=session.date,
            circuit=CircuitInfo(
                id=circuit.id,
                name=circuit.name,
                location=circuit.location,
                country=circuit.country,
                track_length_km=circuit.track_length_km,
                track_map_url=f"/track-maps/{circuit.id}.png",
            ),
            highlights_video_id=getattr(session, "highlights_video_id", None),
        )

        session_results = [
            SessionResultDetail(
                position=result.SessionResult.position,
                status=result.SessionResult.status,
                headshot_url=result.headshot_url,
                driver=DriverInfo(
                    driver_number=result.Driver.driver_number,
                    driver_code=result.Driver.driver_code,
                    driver_slug=result.Driver.driver_slug,
                    full_name=result.Driver.full_name,
                    country_code=result.Driver.country_code,
                ),
                team=TeamInfo(
                    name=result.Team.name,
                    team_color=result.Team.team_color,
                ),
                grid_position=result.SessionResult.grid_position,
                points=sanitize_float(result.SessionResult.points),
                laps_completed=result.SessionResult.laps_completed,
                time_seconds=sanitize_float(result.SessionResult.time_seconds),
                fastest_lap=result.SessionResult.fastest_lap,
                q1_time_seconds=sanitize_float(result.SessionResult.q1_time_seconds),
                q2_time_seconds=sanitize_float(result.SessionResult.q2_time_seconds),
                q3_time_seconds=sanitize_float(result.SessionResult.q3_time_seconds),
            )
            for result in result_rows
        ]

        return SessionResultsResponse(session=session_info, results=session_results)
