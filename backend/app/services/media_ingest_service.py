"""Normalizes, stores, and records an approved source image.

Assets land unapproved. Both resolver gates stay shut until a human runs the
approve command, so a mistaken ingest serves nothing.
"""

import hashlib
import io
from dataclasses import dataclass
from typing import Optional, Tuple

import boto3
import httpx
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import DriverMediaAssignment, MediaAsset
from app.services.media_sources import SourceCandidate, license_allowed

# Set by the largest consumer, the profile banner at roughly 1600px wide.
TARGET_LONG_EDGE = 2048
JPEG_QUALITY = 85
# Below this, archive cards and game cells are visibly soft at 2x.
MIN_LONG_EDGE = 600
CACHE_CONTROL = "public, max-age=31536000, immutable"


class IngestRejected(Exception):
    """The source failed a rights or quality gate."""


@dataclass(frozen=True)
class NormalizedImage:
    data: bytes
    sha256: str
    width: int
    height: int
    was_downscaled: bool

    @property
    def storage_key(self) -> str:
        return f"originals/{self.sha256}.jpg"


def normalize(raw: bytes) -> NormalizedImage:
    """Downscale to the target long edge, strip metadata, re-encode as JPEG.

    Never upscales. A small source stays small and is flagged rather than
    interpolated, because invented detail on a real face is a misidentification
    risk.
    """
    image = Image.open(io.BytesIO(raw))
    image = image.convert("RGB")

    long_edge = max(image.size)
    downscaled = long_edge > TARGET_LONG_EDGE
    if downscaled:
        scale = TARGET_LONG_EDGE / long_edge
        image = image.resize(
            (round(image.width * scale), round(image.height * scale)),
            Image.LANCZOS,
        )

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    data = buffer.getvalue()

    return NormalizedImage(
        data=data,
        sha256=hashlib.sha256(data).hexdigest(),
        width=image.width,
        height=image.height,
        was_downscaled=downscaled,
    )


def check_source(candidate: SourceCandidate, role: str) -> None:
    """Reject on rights or resolution before any bytes are downloaded."""
    if not license_allowed(candidate.license_code):
        raise IngestRejected(
            f"license not permitted: {candidate.license_code or 'unknown'}"
        )
    if not candidate.mime_type.startswith("image/"):
        raise IngestRejected(f"not an image: {candidate.mime_type}")
    if role == "headshot" and candidate.long_edge < MIN_LONG_EDGE:
        raise IngestRejected(
            f"{candidate.long_edge}px long edge is below the {MIN_LONG_EDGE}px floor"
        )


class MediaIngestService:
    """Downloads, normalizes, uploads, and records one driver image."""

    @staticmethod
    def _storage_client():
        return boto3.client(
            "s3",
            endpoint_url=settings.b2_endpoint,
            aws_access_key_id=settings.b2_key_id,
            aws_secret_access_key=settings.b2_application_key,
        )

    @staticmethod
    def download(url: str) -> bytes:
        from app.services.media_sources import USER_AGENT

        response = httpx.get(
            url, headers={"User-Agent": USER_AGENT}, timeout=60.0, follow_redirects=True
        )
        response.raise_for_status()
        return response.content

    @staticmethod
    def upload(image: NormalizedImage) -> str:
        """Put the normalized original at its content-addressed key."""
        MediaIngestService._storage_client().put_object(
            Bucket=settings.b2_bucket,
            Key=image.storage_key,
            Body=image.data,
            ContentType="image/jpeg",
            CacheControl=CACHE_CONTROL,
        )
        return image.storage_key

    @staticmethod
    async def find_by_hash(db: AsyncSession, sha256: str) -> Optional[MediaAsset]:
        result = await db.execute(select(MediaAsset).where(MediaAsset.sha256 == sha256))
        return result.scalar_one_or_none()

    @staticmethod
    async def record_asset(
        db: AsyncSession,
        candidate: SourceCandidate,
        image: NormalizedImage,
    ) -> Tuple[MediaAsset, bool]:
        """Create the asset row, or return the existing one for this content."""
        existing = await MediaIngestService.find_by_hash(db, image.sha256)
        if existing is not None:
            return existing, False

        asset = MediaAsset(
            storage_key=image.storage_key,
            sha256=image.sha256,
            mime_type="image/jpeg",
            width=image.width,
            height=image.height,
            source_provider="wikimedia",
            source_url=candidate.page_url or candidate.file_url,
            author_name=candidate.author_name,
            license_code=candidate.license_code,
            license_url=candidate.license_url,
            attribution_text=candidate.attribution_text,
            rights_status="pending",
        )
        db.add(asset)
        await db.flush()
        return asset, True

    @staticmethod
    async def assign(
        db: AsyncSession,
        driver_id: int,
        asset: MediaAsset,
        role: str,
        year: Optional[int],
        visual_grade: str = "acceptable",
    ) -> Tuple[DriverMediaAssignment, bool]:
        """Bind an asset to a driver context, replacing any existing binding."""
        result = await db.execute(
            select(DriverMediaAssignment).where(
                DriverMediaAssignment.driver_id == driver_id,
                DriverMediaAssignment.role == role,
                DriverMediaAssignment.year.is_(None)
                if year is None
                else DriverMediaAssignment.year == year,
            )
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            existing.media_asset_id = asset.id
            existing.visual_grade = visual_grade
            existing.reviewed_at = None
            return existing, False

        assignment = DriverMediaAssignment(
            driver_id=driver_id,
            year=year,
            role=role,
            media_asset_id=asset.id,
            visual_grade=visual_grade,
        )
        db.add(assignment)
        await db.flush()
        return assignment, True
