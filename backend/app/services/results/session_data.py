"""Session data service: seasons, sessions, rounds, weather, track context."""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Circuit,
    CircuitVenue,
    Constructor,
    Driver,
    Lap,
    RaceControlMessage,
    Session,
    SessionResult,
    Team,
    TrackStatus,
    Weather,
)
from app.schemas.result import (
    CircuitInfo,
    DistributionLap,
    DriverInfo,
    DriverLapDistribution,
    LapDistributionResponse,
    RaceControlEvent,
    RoundPodiumDriver,
    RoundSummary,
    SeasonRoundsResponse,
    SessionInfo,
    SessionResultDetail,
    SessionResultsResponse,
    TeamInfo,
    TrackStatusEvent,
    WeatherDataPoint,
    WeatherResponse,
)
from app.services.results.common import (
    _make_slug,
    headshot_fallback_expr,
    sanitize_float,
)


class SessionDataService:
    """Session data service: seasons, sessions, rounds, weather, track context."""

    @staticmethod
    async def get_available_seasons(db: AsyncSession) -> List[int]:
        """
        Get all available seasons/years that have session data.
        """
        query = select(Session.year).distinct().order_by(Session.year.desc())
        result = await db.execute(query)
        seasons = [row[0] for row in result.all()]
        return seasons

    @staticmethod
    async def get_latest_race_session(db: AsyncSession) -> Optional[Session]:
        """
        Get the most recent race session.
        """
        query = (
            select(Session)
            .where(Session.session_type == "race")
            .order_by(Session.date.desc())
            .limit(1)
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_podium_results(db: AsyncSession, session_id: int):
        """
        Get top 3 finishers for a given session.
        """
        query = (
            select(
                Session.round,
                Session.event_name,
                Session.date,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                Circuit.id.label("circuit_id"),
                CircuitVenue.slug.label("venue_slug"),
                Circuit.location.label("circuit_location"),
                Circuit.country.label("circuit_country"),
                SessionResult.position,
                Driver.full_name,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.country_code,
                headshot_fallback_expr().label("headshot_url"),
                Team.name.label("team_name"),
                Team.team_color,
                Team.logo_url,
                SessionResult.fastest_lap,
                SessionResult.time_seconds,
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .join(CircuitVenue, CircuitVenue.id == Circuit.venue_id)
            .where(Session.id == session_id)
            .where(SessionResult.position.between(1, 3))
            .order_by(SessionResult.position)
        )

        result = await db.execute(query)
        return result.all()

    @staticmethod
    async def get_season_rounds(
        db: AsyncSession, season: int
    ) -> Optional[SeasonRoundsResponse]:
        """
        Get all rounds for a season with top 3 finishers for each.
        """
        query = (
            select(
                Session.round,
                Session.event_name,
                Session.date,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                Circuit.id.label("circuit_id"),
                CircuitVenue.slug.label("venue_slug"),
                Circuit.track_length_km,
                SessionResult.position,
                Driver.full_name,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.country_code,
                headshot_fallback_expr().label("headshot_url"),
                Team.name.label("team_name"),
                Team.team_color,
                Team.logo_url,
                SessionResult.fastest_lap,
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .join(CircuitVenue, CircuitVenue.id == Circuit.venue_id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.position.between(1, 3))
            .order_by(
                Session.round,
                Session.date,
                SessionResult.position,
            )
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        rounds_dict = {}
        for row in rows:
            key = (row.round, row.session_type)
            if key not in rounds_dict:
                rounds_dict[key] = {
                    "round": row.round,
                    "event_name": row.event_name,
                    "date": row.date,
                    "circuit_name": row.circuit_name,
                    "circuit_id": row.circuit_id,
                    "venue_slug": row.venue_slug,
                    "track_length_km": row.track_length_km,
                    "session_type": row.session_type,
                    "podium": [],
                }
            rounds_dict[key]["podium"].append(
                RoundPodiumDriver(
                    full_name=row.full_name,
                    driver_code=row.driver_code,
                    driver_slug=_make_slug(row.jolpica_id, row.full_name),
                    country_code=row.country_code,
                    team_name=row.team_name,
                    team_color=row.team_color,
                    logo_url=row.logo_url,
                    headshot_url=row.headshot_url,
                    fastest_lap=row.fastest_lap,
                )
            )

        rounds = [RoundSummary(**round_data) for round_data in rounds_dict.values()]
        return SeasonRoundsResponse(year=season, rounds=rounds)

    @staticmethod
    async def get_round_details(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[SessionResultsResponse]:
        """
        Get full results for a specific round (main race).
        """
        session_query = (
            select(Session)
            .options(selectinload(Session.circuit).selectinload(Circuit.venue))
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "race")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        # Get all results for this session with driver/team info
        results_query = (
            select(
                SessionResult,
                Driver,
                Team,
                Constructor.slug.label("constructor_slug"),
                headshot_fallback_expr().label("headshot_url"),
            )
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Constructor, Constructor.id == Team.constructor_id)
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
                venue_slug=circuit.venue.slug,
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
                    constructor_slug=result.constructor_slug,
                    team_color=result.Team.team_color,
                    logo_url=result.Team.logo_url,
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
    async def get_track_status(
        db: AsyncSession, session_id: int
    ) -> List[TrackStatusEvent]:
        """
        Get all track status change events for a session.
        Returns events sorted by time.
        """
        query = (
            select(
                TrackStatus.session_time_seconds,
                TrackStatus.status,
                TrackStatus.message,
            )
            .where(TrackStatus.session_id == session_id)
            .order_by(TrackStatus.session_time_seconds)
        )

        result = await db.execute(query)
        rows = result.all()

        return [
            TrackStatusEvent(
                session_time_seconds=row.session_time_seconds,
                status=row.status,
                message=row.message,
            )
            for row in rows
        ]

    @staticmethod
    async def get_race_control_events(
        db: AsyncSession, session_id: int
    ) -> List[RaceControlEvent]:
        """
        Get race control messages for a session.
        Returns key events sorted by time.
        """
        query = (
            select(
                RaceControlMessage.session_time_seconds,
                RaceControlMessage.lap_number,
                RaceControlMessage.category,
                RaceControlMessage.message,
                RaceControlMessage.flag,
                RaceControlMessage.scope,
                RaceControlMessage.driver_number,
            )
            .where(RaceControlMessage.session_id == session_id)
            .order_by(RaceControlMessage.session_time_seconds)
        )

        result = await db.execute(query)
        rows = result.all()

        return [
            RaceControlEvent(
                session_time_seconds=row.session_time_seconds,
                lap_number=row.lap_number,
                category=row.category,
                message=row.message,
                flag=row.flag,
                scope=row.scope,
                driver_number=row.driver_number,
            )
            for row in rows
        ]

    @staticmethod
    async def get_weather_data(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[WeatherResponse]:
        """
        Get weather data for a race session.
        """
        session_query = (
            select(Session)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "race")
        )

        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()

        if not session:
            return None

        query = (
            select(
                Weather.session_time_seconds,
                Weather.air_temp,
                Weather.track_temp,
                Weather.humidity,
                Weather.pressure,
                Weather.wind_speed,
                Weather.wind_direction,
                Weather.rainfall,
            )
            .where(Weather.session_id == session.id)
            .order_by(Weather.session_time_seconds)
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        weather = [
            WeatherDataPoint(
                session_time_seconds=row.session_time_seconds,
                air_temp=row.air_temp,
                track_temp=row.track_temp,
                humidity=row.humidity,
                pressure=row.pressure,
                wind_speed=row.wind_speed,
                wind_direction=row.wind_direction,
                rainfall=row.rainfall,
            )
            for row in rows
        ]

        return WeatherResponse(
            year=season,
            round=round_num,
            event_name=session.event_name,
            weather=weather,
        )

    @staticmethod
    async def get_lap_distribution(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[LapDistributionResponse]:
        """
        Get lap time distribution data for all drivers in a specific race.

        Returns only valid laps (non-null lap_time_seconds) with compound info,
        grouped by driver and sorted by finishing position. Used for the ridge
        plot distribution chart.
        """
        session_query = (
            select(Session)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "race")
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
                Lap.driver_id,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
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
            .where(Lap.lap_time_seconds.isnot(None))
            .order_by(SessionResult.position, Lap.lap_number)
        )

        laps_result = await db.execute(laps_query)
        lap_rows = laps_result.all()

        if not lap_rows:
            return None

        drivers_dict: dict = {}
        for row in lap_rows:
            key = row.driver_id
            if key not in drivers_dict:
                drivers_dict[key] = {
                    "driver_code": row.driver_code,
                    "driver_slug": _make_slug(row.jolpica_id, row.full_name),
                    "full_name": row.full_name,
                    "team_color": row.team_color,
                    "final_position": row.final_position,
                    "laps": [],
                }

            t = sanitize_float(row.lap_time_seconds)
            if t is not None:
                drivers_dict[key]["laps"].append(
                    DistributionLap(
                        lap_number=row.lap_number,
                        lap_time_seconds=t,
                        compound=row.compound,
                    )
                )

        drivers = [DriverLapDistribution(**data) for data in drivers_dict.values()]

        return LapDistributionResponse(
            year=season,
            round=round_num,
            event_name=session.event_name,
            drivers=drivers,
        )
