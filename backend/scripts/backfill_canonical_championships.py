#!/usr/bin/env python3
"""Backfill official standings and circuit source IDs from Jolpica.

The command is dry-run by default. Pass ``--apply`` only after the identity audit
is clean. Each season is committed atomically; unresolved source IDs abort that
season instead of producing a partial canonical snapshot.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import date
from decimal import Decimal
from pathlib import Path

import requests
from sqlalchemy import delete, select

from app.models import (
    ChampionshipClassificationException,
    Circuit,
    CircuitVenueExternalId,
    ConstructorChampionshipStanding,
    ConstructorExternalId,
    DriverChampionshipStanding,
    DriverExternalId,
    Session,
    Team,
)
from scripts.ingest.utils import get_db_session

API_ROOT = "https://api.jolpi.ca/ergast/f1"
OVERRIDES_PATH = (
    Path(__file__).resolve().parents[1] / "data" / "championship_overrides.json"
)
MIN_REQUEST_INTERVAL_SECONDS = 0.4
MAX_RATE_LIMIT_RETRIES = 6
_last_request_at = 0.0


def _override_data() -> dict:
    return json.loads(OVERRIDES_PATH.read_text())


def _standing_override(year: int, entrant_type: str) -> dict | None:
    return next(
        (
            item
            for item in _override_data()["standing_overrides"]
            if item["year"] == year and item["entrant_type"] == entrant_type
        ),
        None,
    )


def _json(url: str) -> dict:
    global _last_request_at
    for attempt in range(MAX_RATE_LIMIT_RETRIES):
        wait = MIN_REQUEST_INTERVAL_SECONDS - (time.monotonic() - _last_request_at)
        if wait > 0:
            time.sleep(wait)
        response = requests.get(url, timeout=60)
        _last_request_at = time.monotonic()
        if response.status_code != 429:
            response.raise_for_status()
            return response.json()["MRData"]
        retry_after = response.headers.get("Retry-After")
        time.sleep(float(retry_after) if retry_after else min(2**attempt, 30))
    response.raise_for_status()
    raise RuntimeError("unreachable")


def _years(db, value: str | None, missing_only: bool = False) -> list[int]:
    available = list(db.scalars(select(Session.year).distinct().order_by(Session.year)))
    if missing_only:
        current_year = date.today().year
        reviewed_override_years = {
            item["year"] for item in _override_data()["standing_overrides"]
        } | {item["year"] for item in _override_data()["classification_exceptions"]}
        final_driver_years = set(
            db.scalars(
                select(DriverChampionshipStanding.year)
                .where(DriverChampionshipStanding.is_final.is_(True))
                .distinct()
            )
        )
        final_constructor_years = set(
            db.scalars(
                select(ConstructorChampionshipStanding.year)
                .where(ConstructorChampionshipStanding.is_final.is_(True))
                .distinct()
            )
        )
        any_driver_years = set(
            db.scalars(select(DriverChampionshipStanding.year).distinct())
        )
        any_constructor_years = set(
            db.scalars(select(ConstructorChampionshipStanding.year).distinct())
        )
        return [
            year
            for year in available
            if year in reviewed_override_years
            or (
                year < current_year
                and (
                    year not in final_driver_years
                    or year >= 1958
                    and year not in final_constructor_years
                )
            )
            or (
                year >= current_year
                and (
                    year not in any_driver_years
                    or year >= 1958
                    and year not in any_constructor_years
                )
            )
        ]
    if not value:
        return available
    years: set[int] = set()
    for part in value.split(","):
        if "-" in part:
            start, end = (int(item) for item in part.split("-", 1))
            years.update(range(start, end + 1))
        else:
            years.add(int(part))
    return sorted(years)


def _standing_list(year: int, kind: str) -> tuple[int, list[dict], str]:
    url = f"{API_ROOT}/{year}/{kind}standings.json?limit=200"
    table = _json(url)["StandingsTable"]
    lists = table.get("StandingsLists", [])
    if not lists:
        return 0, [], url
    return int(lists[0].get("round") or 0), lists[0][f"{kind.title()}Standings"], url


def _driver_id(db, external_id: str) -> int | None:
    return db.scalar(
        select(DriverExternalId.driver_id).where(
            DriverExternalId.source == "jolpica",
            DriverExternalId.external_id == external_id,
        )
    )


def _team_id(db, year: int, external_id: str) -> int | None:
    return db.scalar(
        select(Team.id)
        .join(
            ConstructorExternalId,
            ConstructorExternalId.constructor_id == Team.constructor_id,
        )
        .where(
            Team.year == year,
            ConstructorExternalId.source == "jolpica",
            ConstructorExternalId.external_id == external_id,
        )
    )


def _backfill_circuits(db, year: int) -> tuple[list[str], int]:
    url = f"{API_ROOT}/{year}.json?limit=200"
    races = _json(url)["RaceTable"].get("Races", [])
    errors = []
    for race in races:
        round_num = int(race["round"])
        circuit_id = race["Circuit"]["circuitId"]
        layout_id = db.scalar(
            select(Session.circuit_id)
            .where(Session.year == year, Session.round == round_num)
            .limit(1)
        )
        if layout_id is None:
            continue
        venue_id = db.scalar(select(Circuit.venue_id).where(Circuit.id == layout_id))
        existing = db.scalar(
            select(CircuitVenueExternalId).where(
                CircuitVenueExternalId.source == "jolpica",
                CircuitVenueExternalId.external_id == circuit_id,
            )
        )
        if existing and existing.venue_id != venue_id:
            errors.append(
                f"circuit {circuit_id} maps to venues {existing.venue_id} and {venue_id}"
            )
        elif not existing:
            db.add(
                CircuitVenueExternalId(
                    venue_id=venue_id, source="jolpica", external_id=circuit_id
                )
            )
    final_round = max((int(race["round"]) for race in races), default=0)
    return errors, final_round


def _backfill_year(db, year: int) -> list[str]:
    errors, final_round = _backfill_circuits(db, year)
    driver_round, drivers, driver_url = _standing_list(year, "driver")
    if year >= 1958:
        constructor_round, constructors, constructor_url = _standing_list(
            year, "constructor"
        )
    else:
        constructor_round, constructors, constructor_url = 0, [], ""
    is_final = year < date.today().year or (
        final_round > 0
        and driver_round >= final_round
        and (year < 1958 or constructor_round >= final_round)
    )

    driver_rows = []
    for standing in drivers:
        # Jolpica includes unclassified zero-point entrants in historical
        # standings without a numeric position. They remain visible through
        # observed session results, but cannot occupy a canonical ranked row.
        if standing.get("position") is None:
            continue
        external_id = standing["Driver"]["driverId"]
        driver_id = _driver_id(db, external_id)
        if driver_id is None:
            errors.append(f"unmapped driver {external_id}")
            continue
        driver_rows.append((driver_id, standing))

    constructor_rows = []
    for standing in constructors:
        # Excluded/not-classified entrants have no official numeric position.
        # Entrant-specific exceptions (for example McLaren in 2007) are stored
        # separately and merged into the API response by the standings service.
        if standing.get("position") is None:
            continue
        external_id = standing["Constructor"]["constructorId"]
        team_id = _team_id(db, year, external_id)
        if team_id is None:
            errors.append(f"unmapped {year} constructor {external_id}")
            continue
        constructor_rows.append((team_id, standing))

    driver_override = _standing_override(year, "driver")
    if driver_override:
        driver_rows = []
        driver_url = driver_override["source_url"]
        for standing in driver_override["entries"]:
            driver_id = _driver_id(db, standing["external_id"])
            if driver_id is None:
                errors.append(f"unmapped driver {standing['external_id']}")
                continue
            driver_rows.append((driver_id, standing))

    constructor_override = _standing_override(year, "constructor")
    if constructor_override:
        constructor_rows = []
        constructor_url = constructor_override["source_url"]
        for standing in constructor_override["entries"]:
            team_id = _team_id(db, year, standing["external_id"])
            if team_id is None:
                errors.append(f"unmapped {year} constructor {standing['external_id']}")
                continue
            constructor_rows.append((team_id, standing))

    exception_rows = []
    for item in _override_data()["classification_exceptions"]:
        if item["year"] != year:
            continue
        if item["entrant_type"] == "driver":
            entity_id = _driver_id(db, item["external_id"])
        else:
            entity_id = _team_id(db, year, item["external_id"])
        if entity_id is None:
            errors.append(
                f"unmapped {year} {item['entrant_type']} exception "
                f"{item['external_id']}"
            )
            continue
        exception_rows.append((entity_id, item))

    if errors:
        return errors

    db.execute(
        delete(DriverChampionshipStanding).where(
            DriverChampionshipStanding.year == year
        )
    )
    for driver_id, standing in driver_rows:
        db.add(
            DriverChampionshipStanding(
                year=year,
                driver_id=driver_id,
                position=int(standing["position"]),
                championship_points=Decimal(standing["points"]),
                wins=int(standing.get("wins") or 0),
                source_round=driver_round,
                is_final=is_final,
                source_url=driver_url,
            )
        )

    if year >= 1958:
        db.execute(
            delete(ConstructorChampionshipStanding).where(
                ConstructorChampionshipStanding.year == year
            )
        )
        for team_id, standing in constructor_rows:
            db.add(
                ConstructorChampionshipStanding(
                    year=year,
                    team_id=team_id,
                    position=int(standing["position"]),
                    championship_points=Decimal(standing["points"]),
                    wins=int(standing.get("wins") or 0),
                    source_round=constructor_round,
                    is_final=is_final,
                    source_url=constructor_url,
                )
            )

    for entity_id, item in exception_rows:
        if item["entrant_type"] == "driver":
            db.execute(
                delete(DriverChampionshipStanding).where(
                    DriverChampionshipStanding.year == year,
                    DriverChampionshipStanding.driver_id == entity_id,
                )
            )
            db.execute(
                delete(ChampionshipClassificationException).where(
                    ChampionshipClassificationException.year == year,
                    ChampionshipClassificationException.driver_id == entity_id,
                )
            )
            entity_values = {"driver_id": entity_id}
        else:
            db.execute(
                delete(ConstructorChampionshipStanding).where(
                    ConstructorChampionshipStanding.year == year,
                    ConstructorChampionshipStanding.team_id == entity_id,
                )
            )
            db.execute(
                delete(ChampionshipClassificationException).where(
                    ChampionshipClassificationException.year == year,
                    ChampionshipClassificationException.team_id == entity_id,
                )
            )
            entity_values = {"team_id": entity_id}
        db.add(
            ChampionshipClassificationException(
                year=year,
                entrant_type=item["entrant_type"],
                status=item["status"],
                points_scored=Decimal(item["points_scored"]),
                explanation=item["explanation"],
                source_url=item["source_url"],
                **entity_values,
            )
        )
    return []


def main() -> int:
    parser = argparse.ArgumentParser()
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--years", help="Comma-separated years or ranges")
    selection.add_argument(
        "--missing-only",
        action="store_true",
        help="Backfill only seasons without a required canonical snapshot",
    )
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    db = get_db_session()
    failed = False
    try:
        years = _years(db, args.years, missing_only=args.missing_only)
        if not years:
            print("Canonical championship snapshots are complete")
        for year in years:
            try:
                errors = _backfill_year(db, year)
                if errors:
                    db.rollback()
                    failed = True
                    print(f"{year}: BLOCKED: {'; '.join(errors)}")
                    continue
                if args.apply:
                    db.commit()
                    print(f"{year}: applied")
                else:
                    db.rollback()
                    print(f"{year}: validated (dry run)")
            except Exception as exc:
                db.rollback()
                failed = True
                print(f"{year}: ERROR: {exc}")
    finally:
        db.close()
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
