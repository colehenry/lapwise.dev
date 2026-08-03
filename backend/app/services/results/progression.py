"""Progression service: cumulative points progression across a season."""

from datetime import date
from typing import Optional

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Circuit,
    ConstructorChampionshipStanding,
    Driver,
    DriverChampionshipStanding,
    Session,
    SessionResult,
    Team,
)
from app.schemas.result import (
    ConstructorProgressionData,
    DriverProgressionData,
    PointsProgressionResponse,
    PointsProgressionRound,
)
from app.services.championship_errors import MissingCanonicalStandingsError


class ProgressionService:
    """Progression service: cumulative points progression across a season."""

    @staticmethod
    async def get_points_progression(
        db: AsyncSession, season: int, mode: str, points_type: str = "race"
    ) -> Optional[PointsProgressionResponse]:
        """
        Get cumulative points progression throughout a season.
        points_type can be 'race' or 'qualifying'.
        """
        if points_type == "qualifying":
            if mode == "drivers":
                return await ProgressionService._get_driver_qualifying_progression(
                    db, season
                )
            else:
                return await ProgressionService._get_constructor_qualifying_progression(
                    db, season
                )

        if mode == "drivers":
            return await ProgressionService._get_driver_progression(db, season)
        else:
            return await ProgressionService._get_constructor_progression(db, season)

    @staticmethod
    async def _get_driver_qualifying_progression(
        db: AsyncSession, season: int
    ) -> Optional[PointsProgressionResponse]:
        # Dynamically determine the max grid size for this season
        quali_types = ["qualifying", "sprint_qualifying"]
        max_pos_result = await db.execute(
            select(func.max(SessionResult.position))
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(quali_types))
        )
        max_grid = max_pos_result.scalar() or 20
        formula_base = int(max_grid) + 1

        # Points: formula_base - position, zero below the grid
        qualifying_points = case(
            (
                SessionResult.position <= max_grid,
                formula_base - SessionResult.position,
            ),
            else_=0,
        )

        query = (
            select(
                Driver.id.label("driver_id"),
                Driver.driver_code,
                Driver.slug,
                Driver.jolpica_id,
                Driver.full_name,
                Team.name.label("team_name"),
                Team.team_color,
                Session.round,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                SessionResult.position,
                func.sum(qualifying_points)
                .over(
                    partition_by=Driver.id,
                    order_by=(Session.round, Session.session_type.desc()),
                )
                .label("cumulative_points"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .distinct(
                Driver.id,
                Session.round,
                Session.session_type,
                Team.team_color,
                Circuit.name,
            )
            .order_by(Driver.id, Session.round, Session.session_type.desc())
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # Get all qualifying sessions
        sessions_query = (
            select(Session.round, Session.event_name, Session.session_type)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .order_by(Session.round, Session.session_type.desc())
        )
        sessions_result = await db.execute(sessions_query)
        all_sessions = [
            (row.round, row.event_name, row.session_type)
            for row in sessions_result.all()
        ]

        drivers_dict = {}
        for row in rows:
            key = row.driver_id
            if key not in drivers_dict:
                drivers_dict[key] = {
                    "driver_code": row.driver_code or row.full_name,
                    "driver_slug": row.slug,
                    "full_name": row.full_name,
                    "team_name": row.team_name,
                    "team_color": row.team_color,
                    "sessions_data": {},
                    "final_score": 0.0,
                }
            if row.round not in drivers_dict[key]["sessions_data"]:
                drivers_dict[key]["sessions_data"][row.round] = {}
            drivers_dict[key]["sessions_data"][row.round][row.session_type] = {
                "cumulative_points": float(row.cumulative_points),
                "position": int(row.position) if row.position else None,
            }
            drivers_dict[key]["final_score"] = max(
                drivers_dict[key]["final_score"], float(row.cumulative_points)
            )

        # Build progression
        for driver_data in drivers_dict.values():
            progression = [
                PointsProgressionRound(
                    round="0", cumulative_points=0.0, position=None, event_name=None
                )
            ]

            for round_num, event_name, session_type in all_sessions:
                round_data = (
                    driver_data["sessions_data"].get(round_num, {}).get(session_type)
                )

                round_id = (
                    f"{round_num}-sq"
                    if session_type == "sprint_qualifying"
                    else str(round_num)
                )

                progression.append(
                    PointsProgressionRound(
                        round=round_id,
                        cumulative_points=round_data["cumulative_points"]
                        if round_data
                        else 0.0,
                        position=round_data["position"] if round_data else None,
                        event_name=event_name,
                    )
                )

            driver_data["progression"] = progression
            del driver_data["sessions_data"]

        sorted_drivers = sorted(
            drivers_dict.items(),
            key=lambda item: item[1]["final_score"],
            reverse=True,
        )
        for idx, (_, driver_data) in enumerate(sorted_drivers):
            driver_data["final_position"] = idx + 1
            del driver_data["final_score"]

        drivers = [DriverProgressionData(**data) for _, data in sorted_drivers]

        return PointsProgressionResponse(
            year=season, type="drivers", drivers=drivers, constructors=None
        )

    @staticmethod
    async def _get_constructor_qualifying_progression(
        db: AsyncSession, season: int
    ) -> Optional[PointsProgressionResponse]:
        quali_types = ["qualifying", "sprint_qualifying"]
        max_pos_result = await db.execute(
            select(func.max(SessionResult.position))
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(quali_types))
        )
        max_grid = max_pos_result.scalar() or 20
        formula_base = int(max_grid) + 1

        qualifying_points = case(
            (
                SessionResult.position <= max_grid,
                formula_base - SessionResult.position,
            ),
            else_=0,
        )

        query = (
            select(
                Team.id.label("team_id"),
                Team.name.label("team_name"),
                Team.team_color,
                Session.round,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                SessionResult.position,
                func.sum(qualifying_points)
                .over(
                    partition_by=Team.id,
                    order_by=(Session.round, Session.session_type.desc()),
                )
                .label("cumulative_points"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .order_by(Team.id, Session.round, Session.session_type.desc())
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # Get all qualifying sessions
        sessions_query = (
            select(Session.round, Session.event_name, Session.session_type)
            .where(Session.year == season)
            .where(Session.session_type.in_(["qualifying", "sprint_qualifying"]))
            .order_by(Session.round, Session.session_type.desc())
        )
        sessions_result = await db.execute(sessions_query)
        all_sessions = [
            (row.round, row.event_name, row.session_type)
            for row in sessions_result.all()
        ]

        teams_dict = {}
        for row in rows:
            key = row.team_id
            if key not in teams_dict:
                teams_dict[key] = {
                    "team_name": row.team_name,
                    "team_color": row.team_color,
                    "sessions_data": {},
                }
            if row.round not in teams_dict[key]["sessions_data"]:
                teams_dict[key]["sessions_data"][row.round] = {}
            if row.session_type not in teams_dict[key]["sessions_data"][row.round]:
                teams_dict[key]["sessions_data"][row.round][row.session_type] = {
                    "cumulative_points": float(row.cumulative_points),
                    "positions": [],
                }
            if row.position:
                teams_dict[key]["sessions_data"][row.round][row.session_type][
                    "positions"
                ].append(int(row.position))

        for team_data in teams_dict.values():
            progression = [
                PointsProgressionRound(
                    round="0", cumulative_points=0.0, event_name=None
                )
            ]
            all_positions = [[]]  # Round 0

            for round_num, event_name, session_type in all_sessions:
                round_data = (
                    team_data["sessions_data"].get(round_num, {}).get(session_type)
                )

                round_id = (
                    f"{round_num}-sq"
                    if session_type == "sprint_qualifying"
                    else str(round_num)
                )

                progression.append(
                    PointsProgressionRound(
                        round=round_id,
                        cumulative_points=round_data["cumulative_points"]
                        if round_data
                        else 0.0,
                        event_name=event_name,
                    )
                )
                all_positions.append(round_data["positions"] if round_data else [])

            team_data["progression"] = progression
            team_data["all_positions"] = all_positions
            del team_data["sessions_data"]

        sorted_teams = sorted(
            teams_dict.items(),
            key=lambda item: item[1]["progression"][-1].cumulative_points,
            reverse=True,
        )
        for idx, (_, team_data) in enumerate(sorted_teams):
            team_data["final_position"] = idx + 1

        constructors = [ConstructorProgressionData(**data) for _, data in sorted_teams]

        return PointsProgressionResponse(
            year=season, type="constructors", drivers=None, constructors=constructors
        )

    @staticmethod
    async def _get_driver_progression(
        db: AsyncSession, season: int
    ) -> Optional[PointsProgressionResponse]:
        query = (
            select(
                Driver.id.label("driver_id"),
                Driver.driver_code,
                Driver.slug,
                Driver.jolpica_id,
                Driver.full_name,
                Team.team_color,
                Session.round,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                func.sum(func.coalesce(SessionResult.points, 0))
                .over(
                    partition_by=Driver.id,
                    order_by=(
                        Session.round,
                        Session.session_type.desc(),
                    ),  # sprint_race before race
                )
                .label("cumulative_points"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .join(Team, SessionResult.team_id == Team.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .distinct(
                Driver.id,
                Session.round,
                Session.session_type,
                Team.team_color,
                Circuit.name,
            )
            .order_by(Driver.id, Session.round, Session.session_type.desc())
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        sessions_query = (
            select(Session.round, Session.event_name, Session.session_type)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .order_by(Session.round, Session.session_type.desc())
        )
        sessions_result = await db.execute(sessions_query)
        all_sessions = [
            (row.round, row.event_name, row.session_type)
            for row in sessions_result.all()
        ]

        drivers_dict = {}
        for row in rows:
            key = row.driver_id
            if key not in drivers_dict:
                drivers_dict[key] = {
                    "driver_code": row.driver_code or row.full_name,
                    "driver_slug": row.slug,
                    "full_name": row.full_name,
                    "team_color": row.team_color,
                    "sessions_data": {},
                }
            if row.round not in drivers_dict[key]["sessions_data"]:
                drivers_dict[key]["sessions_data"][row.round] = {}
            drivers_dict[key]["sessions_data"][row.round][row.session_type] = float(
                row.cumulative_points
            )

        for driver_data in drivers_dict.values():
            progression = [
                PointsProgressionRound(
                    round="0", cumulative_points=0.0, event_name=None
                )
            ]
            last_points = 0.0

            for round_num, event_name, session_type in all_sessions:
                round_data = driver_data["sessions_data"].get(round_num, {})

                if session_type in round_data:
                    last_points = round_data[session_type]

                round_id = (
                    f"{round_num}-sprint"
                    if session_type == "sprint_race"
                    else str(round_num)
                )

                progression.append(
                    PointsProgressionRound(
                        round=round_id,
                        cumulative_points=last_points,
                        event_name=event_name,
                    )
                )

            driver_data["progression"] = progression
            del driver_data["sessions_data"]

        official_rows = (
            await db.execute(
                select(
                    DriverChampionshipStanding.driver_id,
                    DriverChampionshipStanding.position,
                    DriverChampionshipStanding.is_final,
                ).where(DriverChampionshipStanding.year == season)
            )
        ).all()
        if season < date.today().year and not any(
            row.is_final for row in official_rows
        ):
            raise MissingCanonicalStandingsError(
                f"Completed driver season {season} is missing final standings"
            )
        official_positions = {row.driver_id: row.position for row in official_rows}
        sorted_drivers = sorted(
            drivers_dict.items(),
            key=lambda item: (
                official_positions.get(item[0], 10_000),
                -item[1]["progression"][-1].cumulative_points,
            ),
        )
        for idx, (driver_id, driver_data) in enumerate(sorted_drivers):
            driver_data["final_position"] = official_positions.get(driver_id, idx + 1)

        drivers = [DriverProgressionData(**data) for _, data in sorted_drivers]

        return PointsProgressionResponse(
            year=season, type="drivers", drivers=drivers, constructors=None
        )

    @staticmethod
    async def _get_constructor_progression(
        db: AsyncSession, season: int
    ) -> Optional[PointsProgressionResponse]:
        query = (
            select(
                Team.id.label("team_id"),
                Team.name.label("team_name"),
                Team.team_color,
                Session.round,
                Session.session_type,
                Circuit.name.label("circuit_name"),
                func.sum(func.coalesce(SessionResult.points, 0))
                .over(
                    partition_by=Team.id,
                    order_by=(Session.round, Session.session_type.desc()),
                )
                .label("cumulative_points"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .join(Circuit, Session.circuit_id == Circuit.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .distinct(Team.id, Session.round, Session.session_type, Circuit.name)
            .order_by(Team.id, Session.round, Session.session_type.desc())
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # Get all sessions
        sessions_query = (
            select(Session.round, Session.event_name, Session.session_type)
            .where(Session.year == season)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .order_by(Session.round, Session.session_type.desc())
        )
        sessions_result = await db.execute(sessions_query)
        all_sessions = [
            (row.round, row.event_name, row.session_type)
            for row in sessions_result.all()
        ]

        teams_dict = {}
        for row in rows:
            key = row.team_id
            if key not in teams_dict:
                teams_dict[key] = {
                    "team_name": row.team_name,
                    "team_color": row.team_color,
                    "sessions_data": {},
                }
            if row.round not in teams_dict[key]["sessions_data"]:
                teams_dict[key]["sessions_data"][row.round] = {}
            teams_dict[key]["sessions_data"][row.round][row.session_type] = float(
                row.cumulative_points
            )

        for team_data in teams_dict.values():
            progression = [
                PointsProgressionRound(
                    round="0", cumulative_points=0.0, event_name=None
                )
            ]
            last_points = 0.0

            for round_num, event_name, session_type in all_sessions:
                round_data = team_data["sessions_data"].get(round_num, {})

                if session_type in round_data:
                    last_points = round_data[session_type]

                round_id = (
                    f"{round_num}-sprint"
                    if session_type == "sprint_race"
                    else str(round_num)
                )

                progression.append(
                    PointsProgressionRound(
                        round=round_id,
                        cumulative_points=last_points,
                        event_name=event_name,
                    )
                )

            team_data["progression"] = progression
            del team_data["sessions_data"]

        official_rows = (
            await db.execute(
                select(
                    ConstructorChampionshipStanding.team_id,
                    ConstructorChampionshipStanding.position,
                    ConstructorChampionshipStanding.is_final,
                ).where(ConstructorChampionshipStanding.year == season)
            )
        ).all()
        if 1958 <= season < date.today().year and not any(
            row.is_final for row in official_rows
        ):
            raise MissingCanonicalStandingsError(
                f"Completed constructor season {season} is missing final standings"
            )
        official_positions = {row.team_id: row.position for row in official_rows}
        sorted_teams = sorted(
            teams_dict.items(),
            key=lambda item: (
                official_positions.get(item[0], 10_000),
                -item[1]["progression"][-1].cumulative_points,
            ),
        )
        for idx, (team_id, team_data) in enumerate(sorted_teams):
            team_data["final_position"] = official_positions.get(team_id, idx + 1)

        constructors = [ConstructorProgressionData(**data) for _, data in sorted_teams]

        return PointsProgressionResponse(
            year=season, type="constructors", drivers=None, constructors=constructors
        )
