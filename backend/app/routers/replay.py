"""
Replay Router

API endpoints for race replay data.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.security import verify_api_key
from app.services.replay_service import ReplayService
from app.schemas.replay import (
    ReplayListResponse,
    ReplaySeasonsResponse,
    ReplayTrackResponse,
)

router = APIRouter()


@router.get("/seasons", response_model=ReplaySeasonsResponse)
async def get_replay_seasons(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """Get all seasons with available replay data."""
    seasons = await ReplayService.get_replay_seasons(db)
    return ReplaySeasonsResponse(seasons=seasons)


@router.get("/available", response_model=ReplayListResponse)
async def get_available_replays(
    season: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """Get list of races with available replay data for a season."""
    replays = await ReplayService.get_available_replays(db, season)
    return ReplayListResponse(season=season, replays=replays)


@router.get("/track/{circuit_id}", response_model=ReplayTrackResponse)
async def get_replay_track_geometry(
    circuit_id: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """Get latest static replay track geometry for a circuit."""
    data = await ReplayService.get_latest_track_geometry(db, circuit_id)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail=f"No replay track geometry found for circuit {circuit_id}",
        )
    return data


@router.get("/{season}/{round}")
async def get_replay_data(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """
    Get pre-computed replay frame data for a race.

    Returns a gzip-compressed MessagePack blob.
    """
    data = await ReplayService.get_replay_data(db, season, round)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail=f"No replay data found for {season} round {round}",
        )

    return Response(
        content=data,
        media_type="application/x-msgpack",
        headers={
            "Content-Encoding": "gzip",
            "Cache-Control": "public, max-age=86400",
        },
    )
