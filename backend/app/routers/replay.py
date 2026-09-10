"""
Replay Router

API endpoints for race replay data.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.console import ConsoleReplayResponse
from app.schemas.replay import (
    ReplayListResponse,
    ReplaySeasonsResponse,
    ReplayTrackResponse,
)
from app.security import verify_api_key
from app.services.console_replay_service import ConsoleReplayService
from app.services.replay_service import ReplayService

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


@router.get("/preview/latest")
async def get_latest_replay_preview(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """
    Get the downsampled autoplay artifact for the most recent race.

    Returns a gzip-compressed MessagePack blob roughly 26x smaller than the
    full replay. The artifact changes only when a new race is ingested.
    """
    data = await ReplayService.get_latest_preview(db)
    if data is None:
        raise HTTPException(status_code=404, detail="No replay preview available")

    return Response(
        content=data,
        media_type="application/x-msgpack",
        headers={
            "Content-Encoding": "gzip",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
    )


@router.get("/console/{season}/{round}", response_model=ConsoleReplayResponse)
async def get_console_replay(
    season: int,
    round: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_api_key),
):
    """
    Get everything the homepage console draws for one race.

    Reshapes the ingested lap rows into a single payload: the session clock,
    per-car lap traces, track-status windows, stoppage skips and the event
    feed. A finished race never changes, so this caches hard.
    """
    data = await ConsoleReplayService.get_console_replay(db, season, round)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail=f"No console replay data found for {season} round {round}",
        )
    return data


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
