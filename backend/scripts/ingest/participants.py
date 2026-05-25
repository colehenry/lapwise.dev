import pandas as pd
from sqlalchemy import select
from app.models import Driver, Team
from .team_colors import enrich_team_color, normalize_team_name
from .utils import safe_int


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


def ingest_driver(db, driver_data):
    """
    Ingest or update a driver record.

    Uses jolpica_id as the primary stable lookup key (e.g. "fangio", "hamilton").
    Falls back to driver_code (Abbreviation) for modern drivers where jolpica_id
    is not yet stored.

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

    # --- Lookup: jolpica_id first (stable across re-runs), then driver_code ---
    driver = None

    if jolpica_id:
        driver = db.execute(
            select(Driver).where(Driver.jolpica_id == jolpica_id)
        ).scalar_one_or_none()

    if not driver and driver_code:
        code_match = db.execute(
            select(Driver).where(Driver.driver_code == driver_code)
        ).scalar_one_or_none()
        if code_match:
            # Guard against cross-era code collisions (e.g. MSC = Michael + Mick).
            # If jolpica_id is present and conflicts, do NOT attach this result
            # to the code match. Keep distinct identity via jolpica_id.
            if (
                jolpica_id
                and code_match.jolpica_id
                and code_match.jolpica_id != jolpica_id
            ):
                print(
                    "    ⚠ Driver code collision for "
                    f"{driver_code}: existing={code_match.jolpica_id}, incoming={jolpica_id}. "
                    "Keeping incoming driver separate (code set to NULL)."
                )
                # Avoid unique constraint violation on create.
                driver_code = None
            else:
                driver = code_match

    if driver:
        # Backfill any missing identifiers on existing records
        updated = False
        matched_by_jolpica = driver.jolpica_id == jolpica_id if jolpica_id else False
        if jolpica_id and not driver.jolpica_id:
            driver.jolpica_id = jolpica_id
            updated = True
        if driver_code and not driver.driver_code:
            # Check that the code isn't already taken by another driver
            code_taken = db.execute(
                select(Driver).where(Driver.driver_code == driver_code)
            ).scalar_one_or_none()
            if not code_taken:
                driver.driver_code = driver_code
                updated = True
        # Only update full_name when matched by jolpica_id (stable identity),
        # not when matched by driver_code fallback (risk of cross-era collision).
        if matched_by_jolpica and full_name and driver.full_name != full_name:
            driver.full_name = full_name
            updated = True
        if driver.driver_number is None and driver_data.get("DriverNumber") is not None:
            driver.driver_number = safe_int(driver_data.get("DriverNumber"))
            updated = True
        if not driver.country_code:
            cc = _nan_to_none(driver_data.get("CountryCode"))
            if cc:
                driver.country_code = cc
                updated = True
        if updated:
            db.commit()
        return driver.id

    # --- Create new driver ---
    print(f"    + New driver: {full_name} ({driver_code or jolpica_id or 'unknown'})")
    driver = Driver(
        full_name=full_name,
        driver_code=driver_code,
        jolpica_id=jolpica_id,
        driver_number=safe_int(driver_data.get("DriverNumber")),
        country_code=_nan_to_none(driver_data.get("CountryCode")),
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver.id


def ingest_team(db, team_data, year):
    """
    Ingest team for a specific year if it doesn't exist.

    Returns: team_id
    """
    team_name = normalize_team_name(_nan_to_none(team_data.get("TeamName")) or "Unknown")

    team_color = enrich_team_color(team_data, year)

    team = db.execute(
        select(Team).where(Team.year == year, Team.name == team_name)
    ).scalar_one_or_none()

    if team:
        if team_color and not team.team_color:
            team.team_color = team_color
            db.commit()
        return team.id

    print(f"    + New team for {year}: {team_name} (color: {team_color or 'none'})")
    team = Team(year=year, name=team_name, team_color=team_color)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team.id
