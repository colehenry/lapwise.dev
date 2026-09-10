"""Canonical comparison attributes for the daily driver game."""

from dataclasses import dataclass
from typing import Any, Iterable

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.driver_countries import continent, country_name
from app.models import (
    Constructor,
    Driver,
    DriverChampionshipStanding,
    Session,
    SessionResult,
    Team,
)

CAREER_PEAK_LABELS = (
    "World Champion",
    "Grand Prix Winner",
    "Podium Finisher",
    "Points Scorer",
    "F1 Starter",
)


@dataclass(frozen=True)
class ConstructorRecord:
    constructor_id: int
    slug: str
    name: str
    wins: int
    podiums: int
    starts: int
    color: str | None = None


@dataclass(frozen=True)
class DriverAttributes:
    driver_id: int
    driver_slug: str
    full_name: str
    driver_code: str | None
    country_code: str
    country: str
    debut: int
    last_raced: int
    signature_constructor: ConstructorRecord
    constructor_ids: frozenset[int]
    career_peak: int
    career_peak_label: str
    starts: int

    def snapshot(self) -> dict[str, Any]:
        signature = self.signature_constructor
        return {
            "driver_slug": self.driver_slug,
            "full_name": self.full_name,
            "driver_code": self.driver_code,
            "country_code": self.country_code,
            "country": self.country,
            "debut": self.debut,
            "last_raced": self.last_raced,
            "constructor": {
                "id": signature.constructor_id,
                "slug": signature.slug,
                "name": signature.name,
                "color": signature.color,
            },
            "constructor_ids": sorted(self.constructor_ids),
            "career_peak": self.career_peak,
            "career_peak_label": self.career_peak_label,
            "starts": self.starts,
        }


def select_signature_constructor(
    records: Iterable[ConstructorRecord],
) -> ConstructorRecord:
    """Wins, podiums, starts and finally slug establish a stable winner."""
    options = list(records)
    if not options:
        raise ValueError("driver has no constructor history")
    return min(
        options, key=lambda row: (-row.wins, -row.podiums, -row.starts, row.slug)
    )


def _clean_color(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().removeprefix("#")
    if len(normalized) != 6:
        return None
    try:
        int(normalized, 16)
    except ValueError:
        return None
    return normalized.upper()


class DriverAttributeService:
    """Derive game attributes directly from canonical race data."""

    @staticmethod
    async def derive(
        db: AsyncSession, driver_ids: Iterable[int] | None = None
    ) -> dict[int, DriverAttributes]:
        requested = set(driver_ids or [])
        base = (
            select(
                Driver.id,
                Driver.slug,
                Driver.full_name,
                Driver.driver_code,
                Driver.country_code,
                func.min(Session.year).label("debut"),
                func.max(Session.year).label("last_raced"),
                func.count(SessionResult.id).label("starts"),
                func.sum(case((SessionResult.position == 1, 1), else_=0)).label("wins"),
                func.sum(
                    case((SessionResult.position.in_((1, 2, 3)), 1), else_=0)
                ).label("podiums"),
                func.sum(case((SessionResult.points > 0, 1), else_=0)).label(
                    "points_finishes"
                ),
            )
            .join(SessionResult, SessionResult.driver_id == Driver.id)
            .join(Session, Session.id == SessionResult.session_id)
            .where(Session.session_type == "race")
            .group_by(Driver.id)
        )
        if requested:
            base = base.where(Driver.id.in_(requested))
        career_rows = (await db.execute(base)).all()
        if not career_rows:
            return {}
        ids = [row.id for row in career_rows]

        constructor_rows = (
            await db.execute(
                select(
                    SessionResult.driver_id,
                    Constructor.id.label("constructor_id"),
                    Constructor.slug,
                    Constructor.canonical_name,
                    func.sum(case((SessionResult.position == 1, 1), else_=0)).label(
                        "wins"
                    ),
                    func.sum(
                        case((SessionResult.position.in_((1, 2, 3)), 1), else_=0)
                    ).label("podiums"),
                    func.count(SessionResult.id).label("starts"),
                )
                .join(Session, Session.id == SessionResult.session_id)
                .join(Team, Team.id == SessionResult.team_id)
                .join(Constructor, Constructor.id == Team.constructor_id)
                .where(
                    Session.session_type == "race",
                    SessionResult.driver_id.in_(ids),
                )
                .group_by(
                    SessionResult.driver_id,
                    Constructor.id,
                    Constructor.slug,
                    Constructor.canonical_name,
                )
            )
        ).all()
        colors: dict[tuple[int, int], str] = {}
        color_rows = (
            await db.execute(
                select(
                    SessionResult.driver_id,
                    Team.constructor_id,
                    Team.team_color,
                    Session.date,
                )
                .join(Session, Session.id == SessionResult.session_id)
                .join(Team, Team.id == SessionResult.team_id)
                .where(
                    Session.session_type == "race",
                    SessionResult.driver_id.in_(ids),
                    Team.team_color.is_not(None),
                )
                .order_by(Session.date.desc())
            )
        ).all()
        for row in color_rows:
            color = _clean_color(row.team_color)
            if color:
                colors.setdefault((row.driver_id, row.constructor_id), color)

        by_driver: dict[int, list[ConstructorRecord]] = {}
        for row in constructor_rows:
            record = ConstructorRecord(
                constructor_id=row.constructor_id,
                slug=row.slug,
                name=row.canonical_name,
                wins=int(row.wins or 0),
                podiums=int(row.podiums or 0),
                starts=int(row.starts or 0),
                color=colors.get((row.driver_id, row.constructor_id)),
            )
            by_driver.setdefault(row.driver_id, []).append(record)

        champions = set(
            (
                await db.scalars(
                    select(DriverChampionshipStanding.driver_id).where(
                        DriverChampionshipStanding.driver_id.in_(ids),
                        DriverChampionshipStanding.position == 1,
                        DriverChampionshipStanding.is_final.is_(True),
                    )
                )
            ).all()
        )
        output: dict[int, DriverAttributes] = {}
        for row in career_rows:
            constructors = by_driver.get(row.id, [])
            if not row.country_code or not constructors:
                continue
            peak = (
                0
                if row.id in champions
                else 1
                if row.wins
                else 2
                if row.podiums
                else 3
                if row.points_finishes
                else 4
            )
            output[row.id] = DriverAttributes(
                driver_id=row.id,
                driver_slug=row.slug,
                full_name=row.full_name,
                driver_code=row.driver_code,
                country_code=row.country_code,
                country=country_name(row.country_code),
                debut=int(row.debut),
                last_raced=int(row.last_raced),
                signature_constructor=select_signature_constructor(constructors),
                constructor_ids=frozenset(item.constructor_id for item in constructors),
                career_peak=peak,
                career_peak_label=CAREER_PEAK_LABELS[peak],
                starts=int(row.starts),
            )
        return output

    @staticmethod
    def compare(
        guess: DriverAttributes | dict[str, Any], answer: dict[str, Any]
    ) -> dict[str, dict[str, str | None]]:
        candidate = guess.snapshot() if isinstance(guess, DriverAttributes) else guess
        return {
            "debut": DriverAttributeService._year(
                int(candidate["debut"]), int(answer["debut"])
            ),
            "last_raced": DriverAttributeService._year(
                int(candidate["last_raced"]), int(answer["last_raced"])
            ),
            "country": DriverAttributeService._country(
                str(candidate["country_code"]), str(answer["country_code"])
            ),
            "constructor": DriverAttributeService._constructor(candidate, answer),
            "career_peak": DriverAttributeService._peak(
                int(candidate["career_peak"]), int(answer["career_peak"])
            ),
        }

    @staticmethod
    def _year(value: int, answer: int) -> dict[str, str | None]:
        distance = abs(value - answer)
        return {
            "state": "exact" if distance == 0 else "close" if distance <= 3 else "miss",
            "direction": None
            if distance == 0
            else "higher"
            if answer > value
            else "lower",
        }

    @staticmethod
    def _country(value: str, answer: str) -> dict[str, str | None]:
        same_continent = continent(value) is not None and continent(value) == continent(
            answer
        )
        return {
            "state": "exact"
            if value == answer
            else "close"
            if same_continent
            else "miss",
            "direction": None,
        }

    @staticmethod
    def _constructor(
        value: dict[str, Any], answer: dict[str, Any]
    ) -> dict[str, str | None]:
        value_id = int(value["constructor"]["id"])
        answer_id = int(answer["constructor"]["id"])
        overlap = bool(
            set(value.get("constructor_ids", []))
            & set(answer.get("constructor_ids", []))
        )
        return {
            "state": "exact"
            if value_id == answer_id
            else "close"
            if overlap
            else "miss",
            "direction": None,
        }

    @staticmethod
    def _peak(value: int, answer: int) -> dict[str, str | None]:
        distance = abs(value - answer)
        return {
            "state": "exact" if distance == 0 else "close" if distance == 1 else "miss",
            "direction": None,
        }
