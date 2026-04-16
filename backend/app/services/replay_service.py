"""
Replay Service

Business logic for fetching replay data.
"""

import gzip

import msgpack
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ReplayData, Session, Circuit
from app.schemas.replay import ReplayListItem, ReplayTrackResponse


class ReplayService:
    """Service class for replay-related operations."""

    @staticmethod
    async def get_replay_seasons(db: AsyncSession) -> list[int]:
        """Get all seasons that have replay data available."""
        result = await db.execute(
            select(Session.year)
            .join(ReplayData, ReplayData.session_id == Session.id)
            .distinct()
            .order_by(Session.year.desc())
        )
        return [row[0] for row in result.all()]

    @staticmethod
    async def get_available_replays(
        db: AsyncSession, season: int
    ) -> list[ReplayListItem]:
        """Get list of available replays for a season."""
        result = await db.execute(
            select(
                Session.round,
                Session.event_name,
                Session.date,
                Circuit.name,
                Circuit.id,
                ReplayData.total_laps,
                ReplayData.total_duration_seconds,
                ReplayData.driver_count,
                ReplayData.compressed_size_bytes,
            )
            .join(ReplayData, ReplayData.session_id == Session.id)
            .join(Circuit, Circuit.id == Session.circuit_id)
            .where(Session.year == season)
            .where(Session.session_type == "race")
            .order_by(Session.round)
        )

        replays = []
        for row in result.all():
            replays.append(
                ReplayListItem(
                    round=row[0],
                    event_name=row[1],
                    date=str(row[2]),
                    circuit_name=row[3],
                    circuit_id=row[4],
                    total_laps=row[5],
                    total_duration_seconds=row[6],
                    driver_count=row[7],
                    compressed_size_bytes=row[8],
                )
            )

        return replays

    @staticmethod
    async def get_replay_data(
        db: AsyncSession, season: int, round_num: int
    ) -> bytes | None:
        """Get the raw compressed replay blob for a specific race."""
        result = await db.execute(
            select(ReplayData.data)
            .join(Session, Session.id == ReplayData.session_id)
            .where(Session.year == season)
            .where(Session.round == round_num)
            .where(Session.session_type == "race")
        )
        row = result.scalar_one_or_none()
        return row

    @staticmethod
    async def get_latest_track_geometry(
        db: AsyncSession, circuit_id: int
    ) -> ReplayTrackResponse | None:
        """Get latest replay-backed track geometry for a circuit."""
        result = await db.execute(
            select(
                ReplayData.data,
                Session.year,
                Session.round,
                Session.event_name,
                Circuit.id,
                Circuit.name,
            )
            .join(Session, Session.id == ReplayData.session_id)
            .join(Circuit, Circuit.id == Session.circuit_id)
            .where(Session.circuit_id == circuit_id)
            .where(Session.session_type == "race")
            .order_by(Session.year.desc(), Session.round.desc())
            .limit(1)
        )
        row = result.first()
        if row is None:
            return None

        payload = msgpack.unpackb(gzip.decompress(row[0]), raw=False)
        track = payload.get("track")
        if not track or not track.get("polyline"):
            return None

        return ReplayTrackResponse(
            season=row[1],
            round=row[2],
            event_name=row[3],
            circuit_id=row[4],
            circuit_name=row[5],
            track=track,
        )
