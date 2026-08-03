import math

import requests

from .identity import resolve_circuit

API_ROOT = "https://api.jolpi.ca/ergast/f1"


def _event_circuit_id(event) -> str | None:
    event_id = event.get("CircuitId")
    if event_id is not None and not (
        isinstance(event_id, float) and math.isnan(event_id)
    ):
        value = str(event_id).strip()
        if value and value.lower() != "nan":
            return value
    return None


def _stable_circuit_id(event, year: int, round_num: int) -> str | None:
    event_id = _event_circuit_id(event)
    if event_id:
        return event_id
    try:
        response = requests.get(
            f"{API_ROOT}/{year}/{round_num}.json?limit=1", timeout=30
        )
        response.raise_for_status()
        races = response.json()["MRData"]["RaceTable"].get("Races", [])
        if races:
            return str(races[0]["Circuit"]["circuitId"])
    except (requests.RequestException, KeyError, TypeError, ValueError):
        return None
    return None


def ingest_circuit(db, event, year=None, round_num=None):
    """
    Ingest circuit if it doesn't exist.

    Returns: circuit_id
    """
    circuit_name = str(event.get("Location") or "Unknown")
    resolved_year = int(year or event.get("EventDate").year)
    resolved_round = int(round_num or event.get("RoundNumber") or 0)
    fastf1_id = _event_circuit_id(event)
    circuit = resolve_circuit(
        db,
        year=resolved_year,
        round_num=resolved_round,
        source_name=circuit_name,
        location=circuit_name,
        country=str(event.get("Country") or "Unknown"),
        external_id=_stable_circuit_id(event, resolved_year, resolved_round),
        external_aliases=[("fastf1", fastf1_id)] if fastf1_id else None,
    )
    return circuit.id
