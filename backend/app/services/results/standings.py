"""Standings service: season championship standings and teammate head-to-head."""

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Driver,
    Session,
    SessionResult,
    Team,
)
from app.schemas.result import (
    ConstructorStanding,
    DriverStanding,
    StandingsResponse,
    TeammateDriverInfo,
    TeammateH2HResponse,
    TeammateH2HTeam,
)
from app.services.canonical_standings_service import CanonicalStandingsService
from app.services.results.common import (
    _make_slug,
    headshot_fallback_expr,
)


class StandingsService:
    """Standings service: season championship standings and teammate head-to-head."""

    @staticmethod
    async def get_season_standings(
        db: AsyncSession, season: int
    ) -> Optional[StandingsResponse]:
        """
        Get driver and constructor championship standings for a season.
        """
        return await CanonicalStandingsService.get_season_standings(db, season)

        # Compatibility implementation retained temporarily for one release.
        # Check if season exists
        season_check = await db.execute(
            select(Session.id).where(Session.year == season).limit(1)
        )
        if not season_check.first():
            return None

        # ====================================================================
        # Driver Standings Query
        # ====================================================================
        # First, get total points per driver
        points_subquery = (
            select(
                Driver.id.label("driver_id"),
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                func.sum(SessionResult.points).label("total_points"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(SessionResult.points.isnot(None))
            .group_by(
                Driver.id,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
            )
            .subquery()
        )

        # Then, for each driver, get their most recent session
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
            # Get the most recent session_result for this driver
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

        # Per-driver race position histogram (race + sprint_race)
        race_types = ["race", "sprint_race"]
        driver_race_positions: dict[int, dict[int, int]] = {}
        driver_race_pos_result = await db.execute(
            select(
                SessionResult.driver_id,
                SessionResult.position,
                func.count().label("count"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(race_types))
            .where(SessionResult.position.isnot(None))
            .group_by(SessionResult.driver_id, SessionResult.position)
        )
        for row in driver_race_pos_result:
            pos_map = driver_race_positions.setdefault(row.driver_id, {})
            pos_map[int(row.position)] = int(row.count)

        # Build driver standings by combining points with latest team info
        driver_standings_data = []
        standings_result = await db.execute(
            select(points_subquery).order_by(points_subquery.c.total_points.desc())
        )

        for driver_row in standings_result:
            driver_id = driver_row.driver_id
            if driver_id in latest_results:
                session_result, team, headshot_url = latest_results[driver_id]
                pos_counts = driver_race_positions.get(driver_id, {})
                driver_standings_data.append(
                    {
                        "driver_code": driver_row.driver_code,
                        "driver_slug": _make_slug(
                            driver_row.jolpica_id, driver_row.full_name
                        ),
                        "full_name": driver_row.full_name,
                        "country_code": driver_row.country_code,
                        "total_points": driver_row.total_points,
                        "team_name": team.name,
                        "team_color": team.team_color,
                        "headshot_url": headshot_url,
                        "wins": pos_counts.get(1, 0),
                        "p2s": pos_counts.get(2, 0),
                        "p3s": pos_counts.get(3, 0),
                        "position_counts": pos_counts,
                    }
                )

        if not driver_standings_data:
            return None

        # Build driver standings with position
        drivers = [
            DriverStanding(
                position=idx + 1,
                driver_code=row["driver_code"],
                driver_slug=row["driver_slug"],
                full_name=row["full_name"],
                country_code=row["country_code"],
                team_name=row["team_name"],
                team_color=row["team_color"],
                total_points=float(row["total_points"]),
                headshot_url=row["headshot_url"],
                wins=row["wins"],
                p2s=row["p2s"],
                p3s=row["p3s"],
                position_counts=row["position_counts"],
            )
            for idx, row in enumerate(driver_standings_data)
        ]

        # ========================================================================
        # Constructor Standings Query
        # ========================================================================
        # sum points grouped by team
        constructor_query = (
            select(
                Team.name.label("team_name"),
                Team.team_color,
                Team.logo_url,
                func.sum(SessionResult.points).label("total_points"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(SessionResult.points.isnot(None))
            .group_by(Team.id, Team.name, Team.team_color, Team.logo_url)
            .order_by(func.sum(SessionResult.points).desc())
        )

        constructor_result = await db.execute(constructor_query)
        constructor_rows = constructor_result.all()

        # Per-team race position histogram
        team_race_positions: dict[str, dict[int, int]] = {}
        team_race_pos_result = await db.execute(
            select(
                Team.name.label("team_name"),
                SessionResult.position,
                func.count().label("count"),
            )
            .join(SessionResult, Team.id == SessionResult.team_id)
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(race_types))
            .where(SessionResult.position.isnot(None))
            .group_by(Team.name, SessionResult.position)
        )
        for row in team_race_pos_result:
            pos_map = team_race_positions.setdefault(row.team_name, {})
            pos_map[int(row.position)] = int(row.count)

        constructors = [
            ConstructorStanding(
                position=idx + 1,
                team_name=row.team_name,
                team_color=row.team_color,
                logo_url=row.logo_url,
                total_points=float(row.total_points),
                wins=team_race_positions.get(row.team_name, {}).get(1, 0),
                p2s=team_race_positions.get(row.team_name, {}).get(2, 0),
                p3s=team_race_positions.get(row.team_name, {}).get(3, 0),
                position_counts=team_race_positions.get(row.team_name, {}),
            )
            for idx, row in enumerate(constructor_rows)
        ]

        return StandingsResponse(
            year=season, drivers=drivers, constructors=constructors
        )

    @staticmethod
    async def get_teammate_h2h(
        db: AsyncSession, season: int, mode: str = "race"
    ) -> Optional[TeammateH2HResponse]:
        """
        Compute head-to-head teammate comparison for a season.

        mode="race"      → race + sprint_race sessions, position = finishing order
        mode="qualifying" → qualifying + sprint_qualifying sessions, position = grid/quali order
        """
        if mode == "qualifying":
            session_types = ["qualifying", "sprint_qualifying"]
        else:
            session_types = ["race", "sprint_race"]

        query = (
            select(
                Session.round,
                Session.session_type,
                Driver.id.label("driver_id"),
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Team.id.label("team_id"),
                Team.name.label("team_name"),
                Team.team_color,
                Team.logo_url,
                SessionResult.position,
                headshot_fallback_expr().label("headshot_url"),
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(Session.year == season)
            .where(Session.session_type.in_(session_types))
            .where(SessionResult.position.isnot(None))
            .order_by(Session.round, Team.id, SessionResult.position)
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # Group by team
        team_data: dict = {}
        for row in rows:
            team_id = row.team_id
            if team_id not in team_data:
                team_data[team_id] = {
                    "team_name": row.team_name,
                    "team_color": row.team_color,
                    "logo_url": row.logo_url,
                    "rounds": {},
                    "driver_info": {},
                    "driver_appearances": {},
                }
            td = team_data[team_id]
            round_key = f"{row.round}-{row.session_type}"
            if round_key not in td["rounds"]:
                td["rounds"][round_key] = []
            td["rounds"][round_key].append(
                {"driver_id": row.driver_id, "position": int(row.position)}
            )
            did = row.driver_id
            if did not in td["driver_info"]:
                td["driver_info"][did] = {
                    "code": row.driver_code,
                    "full_name": row.full_name,
                    "headshot_url": row.headshot_url,
                }
            td["driver_appearances"][did] = td["driver_appearances"].get(did, 0) + 1

        teams_result = []
        for td in team_data.values():
            # Pick the two drivers with most appearances
            top_drivers = sorted(
                td["driver_appearances"].keys(),
                key=lambda d: td["driver_appearances"][d],
                reverse=True,
            )
            if len(top_drivers) < 2:
                continue
            driver_a_id, driver_b_id = top_drivers[0], top_drivers[1]

            a_wins = b_wins = rounds_compared = 0
            for round_results in td["rounds"].values():
                a_res = next(
                    (r for r in round_results if r["driver_id"] == driver_a_id), None
                )
                b_res = next(
                    (r for r in round_results if r["driver_id"] == driver_b_id), None
                )
                if a_res and b_res:
                    rounds_compared += 1
                    if a_res["position"] < b_res["position"]:
                        a_wins += 1
                    else:
                        b_wins += 1

            if rounds_compared == 0:
                continue

            a_info = td["driver_info"][driver_a_id]
            b_info = td["driver_info"][driver_b_id]

            teams_result.append(
                TeammateH2HTeam(
                    team_name=td["team_name"],
                    team_color=td["team_color"],
                    logo_url=td["logo_url"],
                    driver_a=TeammateDriverInfo(
                        code=a_info["code"],
                        full_name=a_info["full_name"],
                        headshot_url=a_info["headshot_url"],
                        wins=a_wins,
                    ),
                    driver_b=TeammateDriverInfo(
                        code=b_info["code"],
                        full_name=b_info["full_name"],
                        headshot_url=b_info["headshot_url"],
                        wins=b_wins,
                    ),
                    rounds_compared=rounds_compared,
                )
            )

        if not teams_result:
            return None

        # Sort by total wins descending (most active teams first)
        teams_result.sort(
            key=lambda t: -(t.driver_a.wins + t.driver_b.wins), reverse=False
        )

        return TeammateH2HResponse(year=season, teams=teams_result)
