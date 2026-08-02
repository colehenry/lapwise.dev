from datetime import date
from typing import List, Optional

from sqlalchemy import case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Driver, Session, SessionResult, Team
from app.schemas.driver import (
    DriverListItem,
    DriverListResponse,
    DriverProfileResponse,
    DriverRaceHistoryResponse,
    DriverSeasonHistoryResponse,
    DriverSuperlative,
    DriverSuperlativesResponse,
    RaceHistory,
    SeasonHistory,
)


class DriverService:
    """Service for driver-related operations"""

    @staticmethod
    def _session_types(include_sprint: bool) -> List[str]:
        return ["race", "sprint_race"] if include_sprint else ["race"]

    @staticmethod
    async def get_all_drivers(
        db: AsyncSession, include_sprint: bool = True
    ) -> DriverListResponse:
        """
        Get all-time driver listing with career statistics.

        Returns all drivers ordered by total wins DESC, total points DESC.
        """
        session_types = DriverService._session_types(include_sprint)

        # Subquery: get the most recent session date per driver (for headshot + latest_season)
        latest_session_sq = (
            select(
                SessionResult.driver_id,
                func.max(Session.date).label("max_date"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .group_by(SessionResult.driver_id)
            .subquery()
        )

        # Subquery: get headshot and latest_season from most recent race
        latest_info_sq = (
            select(
                SessionResult.driver_id,
                SessionResult.headshot_url,
                Session.year.label("latest_season"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .join(
                latest_session_sq,
                (SessionResult.driver_id == latest_session_sq.c.driver_id)
                & (Session.date == latest_session_sq.c.max_date),
            )
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .distinct(SessionResult.driver_id)
            .subquery()
        )

        # Subquery: count distinct seasons per driver+team
        team_seasons_sq = (
            select(
                SessionResult.driver_id,
                SessionResult.team_id,
                func.count(func.distinct(Session.year)).label("season_count"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.session_type.in_(session_types))
            .group_by(SessionResult.driver_id, SessionResult.team_id)
            .subquery()
        )

        # Subquery: max season count per driver
        max_team_seasons_sq = (
            select(
                team_seasons_sq.c.driver_id,
                func.max(team_seasons_sq.c.season_count).label("max_seasons"),
            )
            .group_by(team_seasons_sq.c.driver_id)
            .subquery()
        )

        # Subquery: get the team with the most seasons (tie-break by team_id desc for most recent)
        primary_team_sq = (
            select(
                team_seasons_sq.c.driver_id,
                Team.name.label("team_name"),
                Team.team_color.label("team_color"),
            )
            .join(Team, team_seasons_sq.c.team_id == Team.id)
            .join(
                max_team_seasons_sq,
                (team_seasons_sq.c.driver_id == max_team_seasons_sq.c.driver_id)
                & (team_seasons_sq.c.season_count == max_team_seasons_sq.c.max_seasons),
            )
            .distinct(team_seasons_sq.c.driver_id)
            .order_by(team_seasons_sq.c.driver_id, team_seasons_sq.c.team_id.desc())
            .subquery()
        )

        # Main query: aggregate stats per driver
        query = (
            select(
                Driver.id,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                func.count(SessionResult.id).label("total_races"),
                func.sum(case((SessionResult.position == 1, 1), else_=0)).label(
                    "total_wins"
                ),
                func.sum(
                    case(
                        (SessionResult.position.in_([1, 2, 3]), 1),
                        else_=0,
                    )
                ).label("total_podiums"),
                func.coalesce(func.sum(SessionResult.points), 0).label("total_points"),
                primary_team_sq.c.team_name.label("current_team"),
                primary_team_sq.c.team_color.label("current_team_color"),
                latest_info_sq.c.headshot_url,
                latest_info_sq.c.latest_season,
                func.min(Session.year).label("first_season"),
            )
            .join(SessionResult, Driver.id == SessionResult.driver_id)
            .join(Session, SessionResult.session_id == Session.id)
            .outerjoin(primary_team_sq, Driver.id == primary_team_sq.c.driver_id)
            .outerjoin(latest_info_sq, Driver.id == latest_info_sq.c.driver_id)
            .where(Session.session_type.in_(session_types))
            .group_by(
                Driver.id,
                Driver.driver_code,
                Driver.jolpica_id,
                Driver.full_name,
                Driver.country_code,
                primary_team_sq.c.team_name,
                primary_team_sq.c.team_color,
                latest_info_sq.c.headshot_url,
                latest_info_sq.c.latest_season,
            )
            .order_by(
                func.sum(case((SessionResult.position == 1, 1), else_=0)).desc(),
                func.coalesce(func.sum(SessionResult.points), 0).desc(),
            )
        )

        result = await db.execute(query)
        rows = result.all()

        from app.services.results.common import _make_slug

        drivers = [
            DriverListItem(
                driver_code=row.driver_code,
                driver_slug=_make_slug(row.jolpica_id, row.full_name),
                full_name=row.full_name,
                country_code=row.country_code,
                headshot_url=row.headshot_url,
                total_wins=int(row.total_wins or 0),
                total_races=int(row.total_races or 0),
                total_podiums=int(row.total_podiums or 0),
                total_points=float(row.total_points or 0),
                current_team=row.current_team,
                current_team_color=row.current_team_color,
                first_season=row.first_season,
                latest_season=row.latest_season,
            )
            for row in rows
        ]

        return DriverListResponse(drivers=drivers, total=len(drivers))

    @staticmethod
    async def get_driver_profile(
        db: AsyncSession, driver_code: str, include_sprint: bool = True
    ) -> Optional[DriverProfileResponse]:
        """
        Get complete driver profile with career statistics.

        Args:
            db: Database session
            driver_code: 3-letter driver code (e.g., VER, HAM)
            include_sprint: Whether to include sprint race results in stats

        Returns:
            DriverProfileResponse with stats or None if not found
        """
        # Get driver basic info
        driver = await DriverService._get_driver_by_code(db, driver_code)
        if not driver:
            return None

        session_types = DriverService._session_types(include_sprint)
        current_year = date.today().year

        # Single aggregate query for all career stats
        stats_query = (
            select(
                func.count(SessionResult.id).label("total_races"),
                func.count(distinct(Session.year)).label("total_seasons"),
                func.sum(case((SessionResult.position == 1, 1), else_=0)).label(
                    "total_wins"
                ),
                func.sum(
                    case((SessionResult.position.in_([1, 2, 3]), 1), else_=0)
                ).label("total_podiums"),
                func.coalesce(func.sum(SessionResult.points), 0).label("total_points"),
                func.min(SessionResult.position).label("best_finish"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(SessionResult.driver_id == driver.id)
            .where(Session.session_type.in_(session_types))
        )
        stats = (await db.execute(stats_query)).first()

        if not stats or not stats.total_races:
            return DriverProfileResponse(
                driver_code=driver.driver_code,
                driver_slug=driver.driver_slug,
                full_name=driver.full_name,
                driver_number=driver.driver_number,
                country_code=driver.country_code,
                headshot_url=None,
                total_seasons=0,
                total_races=0,
                total_championships=0,
                total_wins=0,
                total_podiums=0,
                total_points=0.0,
                best_finish=None,
                current_team=None,
                current_team_color=None,
                latest_season=None,
            )

        # Championship count — one query using subqueries instead of a per-season loop
        dsp_sq = (
            select(
                Session.year,
                SessionResult.driver_id,
                func.sum(SessionResult.points).label("pts"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.session_type.in_(session_types))
            .where(SessionResult.points.isnot(None))
            .where(Session.year < current_year)
            .group_by(Session.year, SessionResult.driver_id)
            .subquery()
        )
        season_max_sq = (
            select(dsp_sq.c.year, func.max(dsp_sq.c.pts).label("max_pts"))
            .group_by(dsp_sq.c.year)
            .subquery()
        )
        total_championships = (
            await db.execute(
                select(func.count().label("n"))
                .select_from(dsp_sq)
                .join(season_max_sq, dsp_sq.c.year == season_max_sq.c.year)
                .where(dsp_sq.c.pts == season_max_sq.c.max_pts)
                .where(dsp_sq.c.driver_id == driver.id)
            )
        ).scalar() or 0

        # Most recent result — current team, headshot, latest season
        recent = (
            await db.execute(
                select(
                    Team.name, Team.team_color, SessionResult.headshot_url, Session.year
                )
                .join(Session, SessionResult.session_id == Session.id)
                .join(Team, SessionResult.team_id == Team.id)
                .where(SessionResult.driver_id == driver.id)
                .where(Session.session_type.in_(session_types))
                .order_by(Session.date.desc())
                .limit(1)
            )
        ).first()

        return DriverProfileResponse(
            driver_code=driver.driver_code,
            driver_slug=driver.driver_slug,
            full_name=driver.full_name,
            driver_number=driver.driver_number,
            country_code=driver.country_code,
            headshot_url=recent.headshot_url if recent else None,
            total_seasons=stats.total_seasons,
            total_races=stats.total_races,
            total_championships=total_championships,
            total_wins=stats.total_wins or 0,
            total_podiums=stats.total_podiums or 0,
            total_points=float(stats.total_points),
            best_finish=stats.best_finish,
            current_team=recent.name if recent else None,
            current_team_color=recent.team_color if recent else None,
            latest_season=recent.year if recent else None,
        )

    @staticmethod
    async def get_season_history(
        db: AsyncSession, driver_code: str
    ) -> Optional[DriverSeasonHistoryResponse]:
        """
        Get driver's championship position and points for each season.
        """
        driver = await DriverService._get_driver_by_code(db, driver_code)
        if not driver:
            return None

        # Get all race results grouped by season
        season_data = await DriverService._get_season_aggregated_results(db, driver.id)

        if not season_data:
            return DriverSeasonHistoryResponse(
                driver_code=driver.driver_code,
                driver_slug=driver.driver_slug,
                full_name=driver.full_name,
                seasons=[],
            )

        years = [row.year for row in season_data]

        # Single query: championship position for all years via window function
        all_pts_sq = (
            select(
                Session.year,
                SessionResult.driver_id,
                func.sum(SessionResult.points).label("pts"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .where(Session.year.in_(years))
            .group_by(Session.year, SessionResult.driver_id)
            .subquery()
        )
        ranked_sq = select(
            all_pts_sq.c.year,
            all_pts_sq.c.driver_id,
            func.rank()
            .over(
                partition_by=all_pts_sq.c.year,
                order_by=all_pts_sq.c.pts.desc(),
            )
            .label("champ_position"),
        ).subquery()
        positions = {
            row.year: row.champ_position
            for row in (
                await db.execute(
                    select(ranked_sq.c.year, ranked_sq.c.champ_position).where(
                        ranked_sq.c.driver_id == driver.id
                    )
                )
            ).all()
        }

        seasons = [
            SeasonHistory(
                year=row.year,
                championship_position=positions.get(row.year),
                total_points=float(row.total_points),
                race_count=int(row.race_count or 0),
                team_name=row.team_name,
                team_color=row.team_color,
            )
            for row in season_data
        ]

        return DriverSeasonHistoryResponse(
            driver_code=driver.driver_code,
            driver_slug=driver.driver_slug,
            full_name=driver.full_name,
            seasons=seasons,
        )

    @staticmethod
    async def get_race_history(
        db: AsyncSession,
        driver_code: str,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
        fetch_all: bool = False,
        include_sprint: bool = True,
    ) -> Optional[DriverRaceHistoryResponse]:
        """
        Get driver's race-by-race results across their career.
        """
        driver = await DriverService._get_driver_by_code(db, driver_code)
        if not driver:
            return None

        available_years = await DriverService._get_available_years(db, driver.id)
        if not available_years:
            return DriverRaceHistoryResponse(
                driver_code=driver.driver_code,
                driver_slug=driver.driver_slug,
                full_name=driver.full_name,
                races=[],
                available_years=[],
            )

        # Determine year range
        if fetch_all:
            start_year = available_years[-1]
            end_year = available_years[0]
        else:
            if end_year is None:
                end_year = available_years[0]
            if start_year is None:
                start_year = max(end_year - 4, available_years[-1])

        # Get all race results in the year range
        race_data = await DriverService._get_races_in_range(
            db, driver.id, start_year, end_year, include_sprint
        )

        races = [
            RaceHistory(
                year=row.year,
                round=row.round,
                race_name=row.event_name,
                session_type=row.session_type,
                position=row.position,
                grid_position=row.grid_position,
                points=float(row.points) if row.points is not None else None,
                team_name=row.team_name,
                team_color=row.team_color,
                status=row.status,
                fastest_lap=bool(row.fastest_lap) if row.fastest_lap else False,
            )
            for row in race_data
        ]

        return DriverRaceHistoryResponse(
            driver_code=driver.driver_code,
            driver_slug=driver.driver_slug,
            full_name=driver.full_name,
            races=races,
            available_years=available_years,
        )

    @staticmethod
    async def get_driver_superlatives(
        db: AsyncSession, driver_code: str, include_sprint: bool = True
    ) -> Optional[DriverSuperlativesResponse]:
        """
        Compute notable career stats and records for a driver.

        All-time stats use the full 1950+ dataset. include_sprint controls
        whether sprint race results count toward wins, starts, fastest laps, etc.
        Only superlatives that clear their threshold are returned — the list
        may be empty for drivers with no standout stats.
        """
        from datetime import date as dt

        driver = await DriverService._get_driver_by_code(db, driver_code)
        if not driver:
            return None

        session_types = DriverService._session_types(include_sprint)
        current_year = dt.today().year
        items: list[DriverSuperlative] = []

        def add(
            id_: str,
            value: str,
            label: str,
            category: str,
            sublabel: Optional[str] = None,
        ) -> None:
            items.append(
                DriverSuperlative(
                    id=id_,
                    value=value,
                    label=label,
                    category=category,
                    sublabel=sublabel,
                )
            )

        # ── CHAMPIONSHIPS ─────────────────────────────────────────────────
        # Points per driver per completed season
        dsp_sq = (
            select(
                Session.year,
                SessionResult.driver_id,
                func.sum(SessionResult.points).label("pts"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(Session.session_type.in_(session_types))
            .where(SessionResult.points.isnot(None))
            .where(Session.year < current_year)
            .group_by(Session.year, SessionResult.driver_id)
            .subquery()
        )
        season_max_sq = (
            select(
                dsp_sq.c.year,
                func.max(dsp_sq.c.pts).label("max_pts"),
            )
            .group_by(dsp_sq.c.year)
            .subquery()
        )
        # Championships per driver (all-time)
        all_champs_sq = (
            select(
                dsp_sq.c.driver_id,
                func.count().label("n"),
            )
            .join(season_max_sq, dsp_sq.c.year == season_max_sq.c.year)
            .where(dsp_sq.c.pts == season_max_sq.c.max_pts)
            .group_by(dsp_sq.c.driver_id)
            .subquery()
        )
        champ_count = (
            await db.execute(
                select(all_champs_sq.c.n).where(all_champs_sq.c.driver_id == driver.id)
            )
        ).scalar() or 0
        if champ_count > 0:
            # Only show if no other driver has more
            champs_rank = (
                (
                    await db.execute(
                        select(func.count().label("n"))
                        .select_from(all_champs_sq)
                        .where(all_champs_sq.c.n > champ_count)
                    )
                ).scalar()
                or 0
            ) + 1
            if champs_rank == 1:
                add(
                    "championships",
                    f"{champ_count}×",
                    "world championship" if champ_count == 1 else "world championships",
                    "record",
                    "all-time leader" if champ_count > 1 else None,
                )

        # ── ALL-TIME WINS ─────────────────────────────────────────────────
        all_wins_sq = (
            select(
                SessionResult.driver_id,
                func.count().label("n"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(SessionResult.position == 1)
            .where(Session.session_type.in_(session_types))
            .group_by(SessionResult.driver_id)
            .subquery()
        )
        driver_wins = (
            await db.execute(
                select(all_wins_sq.c.n).where(all_wins_sq.c.driver_id == driver.id)
            )
        ).scalar() or 0
        if driver_wins > 0:
            wins_rank = (
                (
                    await db.execute(
                        select(func.count().label("n"))
                        .select_from(all_wins_sq)
                        .where(all_wins_sq.c.n > driver_wins)
                    )
                ).scalar()
                or 0
            ) + 1
            if wins_rank == 1:
                add(
                    "wins",
                    str(driver_wins),
                    "race wins",
                    "record",
                    "all-time leader",
                )
            elif wins_rank <= 3:
                add(
                    "wins",
                    str(driver_wins),
                    "race wins",
                    "record",
                    f"#{wins_rank} all-time",
                )

        # ── POLE POSITIONS ────────────────────────────────────────────────
        # Grid position 1 in a race session = started from pole
        all_poles_sq = (
            select(
                SessionResult.driver_id,
                func.count().label("n"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(SessionResult.grid_position == 1)
            .where(Session.session_type.in_(session_types))
            .group_by(SessionResult.driver_id)
            .subquery()
        )
        driver_poles = (
            await db.execute(
                select(all_poles_sq.c.n).where(all_poles_sq.c.driver_id == driver.id)
            )
        ).scalar() or 0
        if driver_poles > 0:
            poles_rank = (
                (
                    await db.execute(
                        select(func.count().label("n"))
                        .select_from(all_poles_sq)
                        .where(all_poles_sq.c.n > driver_poles)
                    )
                ).scalar()
                or 0
            ) + 1
            if poles_rank == 1:
                add(
                    "poles",
                    str(driver_poles),
                    "pole positions",
                    "record",
                    "all-time leader",
                )
            elif poles_rank <= 3:
                add(
                    "poles",
                    str(driver_poles),
                    "pole positions",
                    "record",
                    f"#{poles_rank} all-time",
                )

        # ── FASTEST LAPS ──────────────────────────────────────────────────
        all_fl_sq = (
            select(
                SessionResult.driver_id,
                func.count().label("n"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .where(SessionResult.fastest_lap.is_(True))
            .where(Session.session_type.in_(session_types))
            .group_by(SessionResult.driver_id)
            .subquery()
        )
        driver_fl = (
            await db.execute(
                select(all_fl_sq.c.n).where(all_fl_sq.c.driver_id == driver.id)
            )
        ).scalar() or 0
        if driver_fl > 0:
            fl_rank = (
                (
                    await db.execute(
                        select(func.count().label("n"))
                        .select_from(all_fl_sq)
                        .where(all_fl_sq.c.n > driver_fl)
                    )
                ).scalar()
                or 0
            ) + 1
            if fl_rank == 1:
                add(
                    "fastest_laps",
                    str(driver_fl),
                    "fastest laps",
                    "record",
                    "all-time leader",
                )
            elif fl_rank <= 3:
                add(
                    "fastest_laps",
                    str(driver_fl),
                    "fastest laps",
                    "record",
                    f"#{fl_rank} all-time",
                )

        # ── RACE STARTS ───────────────────────────────────────────────────
        driver_starts = (
            await db.execute(
                select(func.count().label("n"))
                .select_from(SessionResult)
                .join(Session, SessionResult.session_id == Session.id)
                .where(SessionResult.driver_id == driver.id)
                .where(Session.session_type.in_(session_types))
            )
        ).scalar() or 0
        if driver_starts > 0:
            all_starts_sq = (
                select(
                    SessionResult.driver_id,
                    func.count().label("n"),
                )
                .join(Session, SessionResult.session_id == Session.id)
                .where(Session.session_type.in_(session_types))
                .group_by(SessionResult.driver_id)
                .subquery()
            )
            starts_rank = (
                (
                    await db.execute(
                        select(func.count().label("n"))
                        .select_from(all_starts_sq)
                        .where(all_starts_sq.c.n > driver_starts)
                    )
                ).scalar()
                or 0
            ) + 1
            if starts_rank == 1:
                add(
                    "starts",
                    str(driver_starts),
                    "race starts",
                    "record",
                    "all-time leader",
                )
            elif starts_rank <= 3:
                add(
                    "starts",
                    str(driver_starts),
                    "race starts",
                    "record",
                    f"#{starts_rank} all-time",
                )

        # ── CIRCUIT DOMINANCE ─────────────────────────────────────────────
        circuit_row = (
            await db.execute(
                select(
                    Session.event_name,
                    func.count().label("n"),
                )
                .join(SessionResult, Session.id == SessionResult.session_id)
                .where(SessionResult.driver_id == driver.id)
                .where(SessionResult.position == 1)
                .where(Session.session_type.in_(session_types))
                .group_by(Session.event_name)
                .order_by(func.count().desc())
                .limit(1)
            )
        ).first()
        if circuit_row and circuit_row.n >= 2:
            circuit_label = circuit_row.event_name.replace("Grand Prix", "GP")
            add(
                "circuit_wins",
                str(circuit_row.n),
                f"wins at {circuit_label}",
                "circuit",
            )

        # ── TEAM LOYALTY ──────────────────────────────────────────────────
        team_row = (
            await db.execute(
                select(
                    Team.name.label("team_name"),
                    func.count(func.distinct(Session.year)).label("n"),
                )
                .join(SessionResult, Team.id == SessionResult.team_id)
                .join(Session, SessionResult.session_id == Session.id)
                .where(SessionResult.driver_id == driver.id)
                .where(Session.session_type.in_(session_types))
                .group_by(Team.name)
                .order_by(func.count(func.distinct(Session.year)).desc())
                .limit(1)
            )
        ).first()
        if team_row and team_row.n >= 7:
            add(
                "team_loyalty",
                str(team_row.n),
                f"seasons at {team_row.team_name}",
                "record",
            )

        # ── CAREER RETIREMENTS ────────────────────────────────────────────
        retirements = (
            await db.execute(
                select(func.count().label("n"))
                .select_from(SessionResult)
                .join(Session, SessionResult.session_id == Session.id)
                .where(SessionResult.driver_id == driver.id)
                .where(SessionResult.position.is_(None))
                .where(Session.session_type.in_(session_types))
            )
        ).scalar() or 0
        if retirements > 0:
            all_ret_sq = (
                select(
                    SessionResult.driver_id,
                    func.sum(
                        case((SessionResult.position.is_(None), 1), else_=0)
                    ).label("ret"),
                )
                .join(Session, SessionResult.session_id == Session.id)
                .where(Session.session_type.in_(session_types))
                .group_by(SessionResult.driver_id)
                .having(func.count(SessionResult.id) >= 50)
                .subquery()
            )
            ret_rank = (
                (
                    await db.execute(
                        select(func.count().label("n"))
                        .select_from(all_ret_sq)
                        .where(all_ret_sq.c.ret > retirements)
                    )
                ).scalar()
                or 0
            ) + 1
            if ret_rank == 1:
                add(
                    "retirements",
                    str(retirements),
                    "retirements",
                    "fun",
                    "all-time leader",
                )
            elif ret_rank <= 3:
                add(
                    "retirements",
                    str(retirements),
                    "retirements",
                    "fun",
                    f"#{ret_rank} all-time",
                )

        return DriverSuperlativesResponse(
            driver_code=driver.driver_code,
            superlatives=items,
        )

    # =========================================================================
    # Helpers
    # =========================================================================

    @staticmethod
    async def _get_driver_by_code(
        db: AsyncSession, driver_code: str
    ) -> Optional[Driver]:
        # Try jolpica_id first (slug format: "max-verstappen" -> "max_verstappen")
        jolpica_id = driver_code.replace("-", "_")
        query = select(Driver).where(Driver.jolpica_id == jolpica_id)
        result = await db.execute(query)
        driver = result.scalar_one_or_none()
        if driver:
            return driver

        # Try exact driver_code match (VER, HAM, etc.)
        query = select(Driver).where(Driver.driver_code == driver_code.upper())
        result = await db.execute(query)
        driver = result.scalar_one_or_none()
        if driver:
            return driver

        # Fallback: treat as a name slug (e.g. "juan-manuel-fangio")
        name_from_slug = driver_code.replace("-", " ")
        query = select(Driver).where(
            func.lower(Driver.full_name) == name_from_slug.lower()
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def _get_season_aggregated_results(db: AsyncSession, driver_id: int):
        query = (
            select(
                Session.year,
                func.sum(SessionResult.points).label("total_points"),
                func.count(SessionResult.id).label("race_count"),
                func.max(Team.name).label("team_name"),  # Get most recent team
                func.max(Team.team_color).label("team_color"),
            )
            .join(Session, SessionResult.session_id == Session.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.driver_id == driver_id)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .where(SessionResult.points.isnot(None))
            .group_by(Session.year)
            .order_by(Session.year)
        )
        result = await db.execute(query)
        return result.all()

    @staticmethod
    async def _get_available_years(db: AsyncSession, driver_id: int) -> List[int]:
        query = (
            select(Session.year)
            .join(SessionResult, Session.id == SessionResult.session_id)
            .where(SessionResult.driver_id == driver_id)
            .where(Session.session_type.in_(["race", "sprint_race"]))
            .distinct()
            .order_by(Session.year.desc())
        )
        result = await db.execute(query)
        return [row[0] for row in result.all()]

    @staticmethod
    async def _get_races_in_range(
        db: AsyncSession,
        driver_id: int,
        start_year: int,
        end_year: int,
        include_sprint: bool = True,
    ):
        session_types = DriverService._session_types(include_sprint)
        query = (
            select(
                Session.year,
                Session.round,
                Session.event_name,
                Session.session_type,
                SessionResult.position,
                SessionResult.grid_position,
                SessionResult.points,
                SessionResult.status,
                SessionResult.fastest_lap,
                Team.name.label("team_name"),
                Team.team_color,
                Session.date,
            )
            .join(SessionResult, Session.id == SessionResult.session_id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.driver_id == driver_id)
            .where(Session.session_type.in_(session_types))
            .where(Session.year >= start_year)
            .where(Session.year <= end_year)
            .order_by(Session.date)
        )
        result = await db.execute(query)
        return result.all()
