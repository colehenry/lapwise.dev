"""Resolves the image a driver should show for a given season and role.

One entry point for every consumer. Routers and other services must not
reimplement the fallback order.
"""

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import DriverMediaAssignment, MediaAsset, Session, SessionResult

MEDIA_ROLES = ("headshot", "portrait", "banner")

# Ordered best to worst. A lower rank wins.
SOURCE_EXACT_SEASON = 0
SOURCE_CAREER_FALLBACK = 1
SOURCE_LEGACY_RESULT = 2


@dataclass(frozen=True)
class MediaRef:
    """A resolved image plus the provenance a caller may need to display."""

    url: str
    source: int
    attribution_text: Optional[str] = None
    author_name: Optional[str] = None
    license_code: Optional[str] = None
    license_url: Optional[str] = None
    focal_x: Optional[float] = None
    focal_y: Optional[float] = None
    visual_grade: Optional[str] = None

    @property
    def is_owned(self) -> bool:
        return self.source != SOURCE_LEGACY_RESULT


@dataclass(frozen=True)
class _Candidate:
    """One servable assignment, before precedence is applied."""

    driver_id: int
    year: Optional[int]
    storage_key: str
    attribution_text: str
    author_name: Optional[str]
    license_code: str
    license_url: Optional[str]
    focal_x: Optional[float]
    focal_y: Optional[float]
    visual_grade: str


def public_url(storage_key: str) -> Optional[str]:
    """Owned storage URL for a content-addressed key.

    None when storage is unconfigured. Returning a relative path instead would
    emit `/originals/<hash>.jpg` into every response and 404 silently, so an
    unset environment degrades to the legacy image rather than to a broken one.
    """
    base = settings.b2_public_base_url.rstrip("/")
    if not base:
        return None
    return f"{base}/{storage_key.lstrip('/')}"


def rank_candidates(
    candidates: Iterable[_Candidate], year: Optional[int]
) -> Dict[int, MediaRef]:
    """Pick one candidate per driver: exact season first, career fallback next.

    Adjacent seasons are never borrowed. A 2022 image can show the wrong team.
    """
    best: Dict[int, tuple[int, MediaRef]] = {}
    for candidate in candidates:
        if candidate.year is None:
            source = SOURCE_CAREER_FALLBACK
        elif year is not None and candidate.year == year:
            source = SOURCE_EXACT_SEASON
        else:
            continue

        current = best.get(candidate.driver_id)
        if current is not None and current[0] <= source:
            continue

        url = public_url(candidate.storage_key)
        if url is None:
            continue

        best[candidate.driver_id] = (
            source,
            MediaRef(
                url=url,
                source=source,
                attribution_text=candidate.attribution_text,
                author_name=candidate.author_name,
                license_code=candidate.license_code,
                license_url=candidate.license_url,
                focal_x=candidate.focal_x,
                focal_y=candidate.focal_y,
                visual_grade=candidate.visual_grade,
            ),
        )

    return {driver_id: ref for driver_id, (_, ref) in best.items()}


class MediaService:
    """Owned driver media, resolved per driver-season-role."""

    @staticmethod
    async def _servable_candidates(
        db: AsyncSession,
        driver_ids: Sequence[int],
        year: Optional[int],
        role: str,
    ) -> List[_Candidate]:
        """Approved, reviewed assignments for these drivers in one query.

        Both gates are required: rights approval clears the file, assignment
        review clears the identity and season.
        """
        year_filter = DriverMediaAssignment.year.is_(None)
        if year is not None:
            year_filter = year_filter | (DriverMediaAssignment.year == year)

        rows = await db.execute(
            select(
                DriverMediaAssignment.driver_id,
                DriverMediaAssignment.year,
                MediaAsset.storage_key,
                MediaAsset.attribution_text,
                MediaAsset.author_name,
                MediaAsset.license_code,
                MediaAsset.license_url,
                DriverMediaAssignment.focal_x,
                DriverMediaAssignment.focal_y,
                DriverMediaAssignment.visual_grade,
            )
            .join(MediaAsset, DriverMediaAssignment.media_asset_id == MediaAsset.id)
            .where(
                DriverMediaAssignment.driver_id.in_(driver_ids),
                DriverMediaAssignment.role == role,
                DriverMediaAssignment.reviewed_at.isnot(None),
                MediaAsset.rights_status == "approved",
                year_filter,
            )
        )
        return [_Candidate(*row) for row in rows.all()]

    @staticmethod
    async def _legacy_headshots(
        db: AsyncSession, driver_ids: Sequence[int]
    ) -> Dict[int, str]:
        """Most recent `session_results.headshot_url` per driver.

        Migration-only. Deleted with the column at step 10 of the media plan.
        """
        if not driver_ids:
            return {}

        rows = await db.execute(
            select(SessionResult.driver_id, SessionResult.headshot_url, Session.date)
            .join(Session, SessionResult.session_id == Session.id)
            .where(
                SessionResult.driver_id.in_(driver_ids),
                SessionResult.headshot_url.isnot(None),
                SessionResult.headshot_url != "",
            )
            .order_by(SessionResult.driver_id, Session.date.desc())
        )

        latest: Dict[int, str] = {}
        for driver_id, url, _date in rows.all():
            latest.setdefault(driver_id, url)
        return latest

    @staticmethod
    async def resolve_many(
        db: AsyncSession,
        driver_ids: Sequence[int],
        year: Optional[int] = None,
        role: str = "headshot",
    ) -> Dict[int, MediaRef]:
        """Best available image per driver. Absent keys render the placeholder.

        Standings, session results, and game grids resolve twenty or more
        drivers at once, so this is the primary entry point and issues a fixed
        number of queries regardless of driver count.
        """
        if role not in MEDIA_ROLES:
            raise ValueError(f"unknown media role: {role}")

        unique_ids = list(dict.fromkeys(driver_ids))
        if not unique_ids:
            return {}

        candidates = await MediaService._servable_candidates(db, unique_ids, year, role)
        resolved = rank_candidates(candidates, year)

        missing = [driver_id for driver_id in unique_ids if driver_id not in resolved]
        if missing and role == "headshot":
            for driver_id, url in (
                await MediaService._legacy_headshots(db, missing)
            ).items():
                resolved[driver_id] = MediaRef(url=url, source=SOURCE_LEGACY_RESULT)

        return resolved

    @staticmethod
    async def resolve(
        db: AsyncSession,
        driver_id: int,
        year: Optional[int] = None,
        role: str = "headshot",
    ) -> Optional[MediaRef]:
        """Single-driver convenience. Delegates to the batch path."""
        resolved = await MediaService.resolve_many(db, [driver_id], year, role)
        return resolved.get(driver_id)
