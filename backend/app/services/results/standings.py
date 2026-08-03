"""Standings service: season championship standings and teammate head-to-head."""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Driver,
    Session,
    SessionResult,
    Team,
)
from app.schemas.result import (
    StandingsResponse,
    TeammateDriverInfo,
    TeammateH2HResponse,
    TeammateH2HTeam,
)
from app.services.canonical_standings_service import CanonicalStandingsService
from app.services.results.common import (
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
