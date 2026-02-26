"""
Circuits Router

API endpoints for F1 circuits/tracks information.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.circuit_service import CircuitService
from app.schemas.circuit import (
    CircuitResponse,
    CircuitListResponse,
    CircuitRaceHistoryResponse,
    CircuitStatisticsResponse,
)
from app.security import verify_api_key

router = APIRouter()


@router.get("", response_model=CircuitListResponse)
async def get_all_circuits(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get all F1 circuits with statistics.

    Returns a list of all circuits with:
    - Circuit information (name, location, country, track length)
    - Number of times the circuit has hosted races
    - Years the circuit was active
    - Most recent race

    Circuits are ordered by most recent race date.
    """
    return await CircuitService.get_all_circuits(db)


@router.get("/{circuit_id}", response_model=CircuitResponse)
async def get_circuit_by_id(
    circuit_id: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get detailed information for a specific circuit.

    Args:
        circuit_id: Database ID of the circuit
    """
    circuit = await CircuitService.get_circuit_by_id(db, circuit_id)

    if not circuit:
        raise HTTPException(
            status_code=404, detail=f"Circuit with ID {circuit_id} not found"
        )

    return circuit


@router.get("/{circuit_id}/race-history", response_model=CircuitRaceHistoryResponse)
async def get_circuit_race_history(
    circuit_id: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get race winners at this circuit across all years.

    Args:
        circuit_id: Database ID of the circuit
    """
    history = await CircuitService.get_circuit_race_history(db, circuit_id)

    if not history:
        raise HTTPException(
            status_code=404, detail=f"Circuit with ID {circuit_id} not found"
        )

    return history


@router.get("/{circuit_id}/statistics", response_model=CircuitStatisticsResponse)
async def get_circuit_statistics(
    circuit_id: int,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Get aggregated statistics for a circuit.

    Returns most wins, poles, fastest laps by driver, and constructor wins.

    Args:
        circuit_id: Database ID of the circuit
    """
    stats = await CircuitService.get_circuit_statistics(db, circuit_id)

    if not stats:
        raise HTTPException(
            status_code=404, detail=f"Circuit with ID {circuit_id} not found"
        )

    return stats
