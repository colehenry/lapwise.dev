"""Canonical driver route resolution and legacy ambiguity handling."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Driver, DriverExternalId, DriverSeason


class AmbiguousLegacyDriverError(LookupError):
    def __init__(self, code: str, candidates: list[str]):
        self.code = code
        self.candidates = candidates
        super().__init__(f"Driver code {code} is ambiguous")


class DriverIdentityService:
    @staticmethod
    async def resolve(db: AsyncSession, identifier: str) -> Driver | None:
        driver = await db.scalar(
            select(Driver).where(Driver.slug == identifier.lower())
        )
        if driver:
            return driver
        driver = await db.scalar(
            select(Driver)
            .join(DriverExternalId)
            .where(
                DriverExternalId.source == "jolpica",
                DriverExternalId.external_id == identifier.replace("-", "_"),
            )
        )
        if driver:
            return driver
        candidates = (
            await db.scalars(
                select(Driver)
                .join(DriverSeason)
                .where(DriverSeason.driver_code == identifier.upper())
                .distinct()
            )
        ).all()
        if len(candidates) == 1:
            return candidates[0]
        if len(candidates) > 1:
            raise AmbiguousLegacyDriverError(
                identifier, [candidate.slug for candidate in candidates]
            )
        return None
