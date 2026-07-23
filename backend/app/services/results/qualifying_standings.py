"""Qualifying standings service: season qualifying standings and rounds."""

from typing import Optional

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Circuit,
    Driver,
    Session,
    SessionResult,
    Team,
)
from app.schemas.result import (
    ConstructorQualifyingStanding,
    DriverQualifyingStanding,
    QualifyingStandingsResponse,
    RoundPodiumDriver,
    RoundSummary,
    SeasonRoundsResponse,
)
from app.services.results.common import (
    _make_slug,
    headshot_fallback_expr,
)


class QualifyingStandingsService:
    """Qualifying standings service: season qualifying standings and rounds."""

    @staticmethod
    async def get_qualifying_standings(
        db: AsyncSession, season: int
    ) -> Optional[QualifyingStandingsResponse]:
        """
        Get driver and constructor qualifying standings for a season.
        Calculates qualifying points dynamically: formula_base - position,
        where formula_base = (max grid size for the season) + 1. This keeps
        every driver with at least 1 point regardless of grid size.
        """
        # Check if season exists
        season_check = await db.execute(
            select(Session.id).where(Session.year == season).limit(1)
        )
        if not season_check.first():
            return None

        # Dynamically determine the max grid size from qualifying sessions
        quali_types = ["qualifying", "sprint_qualifying"]
        max_pos_result = await db.execute(
            select(func.max(SessionResult.position))
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(quali_types))
        )
        max_grid = max_pos_result.scalar() or 20
        formula_base = int(max_grid) + 1

        # ====================================================================
        # Driver Qualifying Standings Query
        # ====================================================================
        # Points: formula_base - position
        # Session types: qualifying, sprint_qualifying
        points_subquery = (
            select(
                Driver.id.label("driver_id"),
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                func.sum(
                    case(
                        (
                            SessionResult.position <= max_grid,
                            formula_base - SessionResult.position,
                        ),
                        else_=0,
                    )
                ).label("total_points"),
                func.sum(case((SessionResult.position == 1, 1), else_=0)).label(
                    "poles"
                ),
                func.sum(case((SessionResult.position == 2, 1), else_=0)).label("p2s"),
                func.sum(case((SessionResult.position == 3, 1), else_=0)).label("p3s"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(quali_types))
            .where(SessionResult.position.isnot(None))
            .group_by(
                Driver.id,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
            )
            .subquery()
        )

        # Get latest results for team/headshot
        latest_results = {}
        distinct_drivers = await db.execute(
            select(Driver.id)
            .distinct()
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
        )

        for driver_row in distinct_drivers:
            driver_id = driver_row[0]
            latest_result_query = (
                select(
                    SessionResult,
                    Team,
                    headshot_fallback_expr().label("headshot_url"),
                )
                .join(Session, SessionResult.session_id == Session.id)
                .join(Team, SessionResult.team_id == Team.id)
                .join(Driver, SessionResult.driver_id == Driver.id)
                .where(SessionResult.driver_id == driver_id)
                .where(Session.year == season)
                .order_by(Session.date.desc(), Session.round.desc())
                .limit(1)
            )
            result = await db.execute(latest_result_query)
            row = result.first()
            if row:
                latest_results[driver_id] = row

        # Per-driver position histogram across qualifying sessions
        driver_position_counts: dict[int, dict[int, int]] = {}
        driver_pos_result = await db.execute(
            select(
                SessionResult.driver_id,
                SessionResult.position,
                func.count().label("count"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(quali_types))
            .where(SessionResult.position.isnot(None))
            .group_by(SessionResult.driver_id, SessionResult.position)
        )
        for row in driver_pos_result:
            pos_map = driver_position_counts.setdefault(row.driver_id, {})
            pos_map[int(row.position)] = int(row.count)

        # Build driver standings
        driver_standings_data = []
        standings_result = await db.execute(
            select(points_subquery).order_by(points_subquery.c.total_points.desc())
        )

        for driver_row in standings_result:
            driver_id = driver_row.driver_id
            if driver_id in latest_results:
                session_result, team, headshot_url = latest_results[driver_id]
                driver_standings_data.append(
                    {
                        "driver_code": driver_row.driver_code,
                        "driver_slug": _make_slug(
                            driver_row.jolpica_id, driver_row.full_name
                        ),
                        "full_name": driver_row.full_name,
                        "country_code": driver_row.country_code,
                        "total_qualifying_points": float(driver_row.total_points),
                        "team_name": team.name,
                        "team_color": team.team_color,
                        "headshot_url": headshot_url,
                        "poles": int(driver_row.poles),
                        "p2s": int(driver_row.p2s),
                        "p3s": int(driver_row.p3s),
                        "position_counts": driver_position_counts.get(driver_id, {}),
                    }
                )

        drivers = [
            DriverQualifyingStanding(position=idx + 1, **row)
            for idx, row in enumerate(driver_standings_data)
        ]

        # ========================================================================
        # Constructor Qualifying Standings Query
        # ========================================================================
        constructor_query = (
            select(
                Team.name.label("team_name"),
                Team.team_color,
                Team.logo_url,
                func.sum(
                    case(
                        (
                            SessionResult.position <= max_grid,
                            formula_base - SessionResult.position,
                        ),
                        else_=0,
                    )
                ).label("total_points"),
                func.sum(case((SessionResult.position == 1, 1), else_=0)).label(
                    "poles"
                ),
                func.sum(case((SessionResult.position == 2, 1), else_=0)).label("p2s"),
                func.sum(case((SessionResult.position == 3, 1), else_=0)).label("p3s"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(quali_types))
            .where(SessionResult.position.isnot(None))
            .group_by(Team.id, Team.name, Team.team_color, Team.logo_url)
            .order_by(
                func.sum(
                    case(
                        (
                            SessionResult.position <= max_grid,
                            formula_base - SessionResult.position,
                        ),
                        else_=0,
                    )
                ).desc()
            )
        )

        constructor_result = await db.execute(constructor_query)
        constructor_rows = constructor_result.all()

        # Per-team position histogram across qualifying sessions
        team_position_counts: dict[str, dict[int, int]] = {}
        team_pos_result = await db.execute(
            select(
                Team.name.label("team_name"),
                SessionResult.position,
                func.count().label("count"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(quali_types))
            .where(SessionResult.position.isnot(None))
            .group_by(Team.name, SessionResult.position)
        )
        for row in team_pos_result:
            pos_map = team_position_counts.setdefault(row.team_name, {})
            pos_map[int(row.position)] = int(row.count)

        constructors = [
            ConstructorQualifyingStanding(
                position=idx + 1,
                team_name=row.team_name,
                team_color=row.team_color,
                logo_url=row.logo_url,
                total_qualifying_points=float(row.total_points),
                poles=int(row.poles),
                p2s=int(row.p2s),
                p3s=int(row.p3s),
                position_counts=team_position_counts.get(row.team_name, {}),
            )
            for idx, row in enumerate(constructor_rows)
        ]

        return QualifyingStandingsResponse(
            year=season,
            drivers=drivers,
            constructors=constructors,
            formula_base=formula_base,
        )

    @staticmethod
    async def get_season_qualifying_rounds(
        db: AsyncSession, season: int
    ) -> Optional[SeasonRoundsResponse]:
        """
        Get all qualifying rounds for a season with top 3 qualifiers for each.
        Includes both regular qualifying and sprint qualifying.
        """
        query = (
            select(
                Session.round,
                Session.event_name,
                Session.date,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                Circuit.id.label("circuit_id"),
                Circuit.track_length_km,
                SessionResult.position,
                Driver.full_name,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.country_code,
                headshot_fallback_expr().label("headshot_url"),
                Team.name.label("team_name"),
                Team.team_color,
                SessionResult.fastest_lap,
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
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
                    headshot_url=row.headshot_url,
                    fastest_lap=row.fastest_lap,
                )
            )

        rounds = [RoundSummary(**round_data) for round_data in rounds_dict.values()]
        return SeasonRoundsResponse(year=season, rounds=rounds)
