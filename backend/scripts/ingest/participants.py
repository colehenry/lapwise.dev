import json
from pathlib import Path

import pandas as pd

from .identity import resolve_constructor, resolve_driver
from .team_colors import enrich_team_color, normalize_team_name
from .utils import safe_int


IDENTITY_OVERRIDES_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "identity_observation_overrides.json"
)


def apply_participant_identity_override(
    driver_data,
    *,
    year: int,
    round_num: int | None,
    session_type: str,
):
    """Apply a reviewed correction for an incomplete source observation."""
    if round_num is None or not IDENTITY_OVERRIDES_PATH.exists():
        return driver_data

    driver_number = _nan_to_none(driver_data.get("DriverNumber"))
    if driver_number is None:
        return driver_data

    overrides = json.loads(IDENTITY_OVERRIDES_PATH.read_text())["observations"]
    observation = next(
        (
            item
            for item in overrides
            if item["year"] == year
            and item["round"] == round_num
            and item["session_type"] == session_type
        ),
        None,
    )
    if observation is None:
        return driver_data

    values = observation["drivers"].get(driver_number)
    if values is None:
        return driver_data

    corrected = driver_data.copy()
    for key, value in values.items():
        corrected[key] = value
    return corrected


def _nan_to_none(val):
    """Return None if value is NaN/empty, otherwise return stripped string."""
    if val is None:
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    s = str(val).strip()
    return None if not s or s == "nan" else s


def ingest_driver(db, driver_data, year):
    """
    Ingest or update a driver record.

    Uses DriverId through the explicit Jolpica external-ID mapping. Missing
    source IDs create a season-scoped provisional identity for review; driver
    abbreviations are never used as global identity keys.

    Pre-2003 drivers have no official 3-letter codes in Jolpica, so driver_code
    will be NULL for those records. jolpica_id is the only reliable unique key
    for historical drivers.

    Returns: driver_id
    """
    jolpica_id = _nan_to_none(driver_data.get("DriverId"))

    raw_code = driver_data.get("Abbreviation")
    driver_code = _nan_to_none(raw_code)
    if driver_code:
        driver_code = driver_code[:3].upper()

    full_name = _nan_to_none(driver_data.get("FullName")) or "Unknown"

    driver = resolve_driver(
        db,
        year=year,
        external_id=jolpica_id,
        full_name=full_name,
        driver_code=driver_code,
        driver_number=safe_int(driver_data.get("DriverNumber")),
        country_code=_nan_to_none(driver_data.get("CountryCode")),
    )
    return driver.id


def ingest_team(db, team_data, year):
    """
    Ingest team for a specific year if it doesn't exist.

    Returns: team_id
    """
    source_name = _nan_to_none(team_data.get("TeamName")) or "Unknown"
    source_id = _nan_to_none(team_data.get("TeamId"))
    team_name = normalize_team_name(
        source_name,
        year=year,
        team_id=source_id,
    )

    team_color = enrich_team_color(team_data, year)

    team = resolve_constructor(
        db,
        year=year,
        external_id=source_id,
        source_name=source_name,
        display_name=team_name,
        color=team_color,
    )
    return team.id
