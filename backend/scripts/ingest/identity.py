"""Typed identity resolvers used by all ingestion paths."""

from __future__ import annotations

import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Circuit,
    CircuitVenue,
    CircuitVenueExternalId,
    Constructor,
    ConstructorExternalId,
    Driver,
    DriverExternalId,
    DriverSeason,
    IngestIdentityIssue,
    Team,
)
from app.models import (
    Session as RaceSession,
)


class IdentityResolutionError(RuntimeError):
    """Raised before child rows are written when identity is ambiguous."""


def slugify(value: str) -> str:
    ascii_value = (
        unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    )
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-") or "unknown"


def unique_slug(db, model, value: str, *, column_name: str = "slug") -> str:
    base = slugify(value)
    candidate = base
    suffix = 2
    column = getattr(model, column_name)
    while db.execute(select(model.id).where(column == candidate)).scalar_one_or_none():
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def record_issue(
    db,
    *,
    entity_type: str,
    source: str,
    source_id: str | None,
    raw_name: str | None,
    year: int | None,
    round_num: int | None = None,
    details: str,
) -> None:
    issue_db = Session(bind=db.get_bind())
    issue_db.add(
        IngestIdentityIssue(
            entity_type=entity_type,
            source=source,
            source_id=source_id,
            raw_name=raw_name,
            year=year,
            round=round_num,
            details=details,
        )
    )
    issue_db.commit()
    issue_db.close()


def resolve_driver(
    db,
    *,
    year: int,
    external_id: str | None,
    full_name: str,
    driver_code: str | None,
    driver_number: int | None,
    country_code: str | None,
) -> Driver:
    driver = None
    if external_id:
        driver = db.execute(
            select(Driver)
            .join(DriverExternalId)
            .where(
                DriverExternalId.source == "jolpica",
                DriverExternalId.external_id == external_id,
            )
        ).scalar_one_or_none()
        if driver is None:
            driver = db.execute(
                select(Driver).where(Driver.jolpica_id == external_id)
            ).scalar_one_or_none()
            if driver is not None:
                db.add(
                    DriverExternalId(
                        driver_id=driver.id,
                        source="jolpica",
                        external_id=external_id,
                    )
                )
        if driver is None:
            provisional_id = f"{year}:{slugify(full_name)}"
            driver = db.execute(
                select(Driver)
                .join(DriverExternalId)
                .where(
                    DriverExternalId.source == "lapwise-provisional",
                    DriverExternalId.external_id == provisional_id,
                )
            ).scalar_one_or_none()
            if driver is not None:
                db.add(
                    DriverExternalId(
                        driver_id=driver.id,
                        source="jolpica",
                        external_id=external_id,
                    )
                )
                driver.jolpica_id = external_id
    else:
        provisional_id = f"{year}:{slugify(full_name)}"
        driver = db.execute(
            select(Driver)
            .join(DriverExternalId)
            .where(
                DriverExternalId.source == "lapwise-provisional",
                DriverExternalId.external_id == provisional_id,
            )
        ).scalar_one_or_none()

    if driver is None:
        driver = Driver(
            slug=unique_slug(db, Driver, external_id or full_name),
            full_name=full_name,
            driver_code=driver_code,
            jolpica_id=external_id,
            driver_number=driver_number,
            country_code=country_code,
        )
        db.add(driver)
        db.flush()
        db.add(
            DriverExternalId(
                driver_id=driver.id,
                source="jolpica" if external_id else "lapwise-provisional",
                external_id=external_id or f"{year}:{slugify(full_name)}",
            )
        )
        if not external_id:
            record_issue(
                db,
                entity_type="driver",
                source="fastf1",
                source_id=None,
                raw_name=full_name,
                year=year,
                details="Created provisional driver because DriverId was absent",
            )

    season = db.execute(
        select(DriverSeason).where(
            DriverSeason.year == year, DriverSeason.driver_id == driver.id
        )
    ).scalar_one_or_none()
    if season is None:
        if driver_code:
            clash = db.execute(
                select(DriverSeason).where(
                    DriverSeason.year == year,
                    DriverSeason.driver_code == driver_code,
                    DriverSeason.driver_id != driver.id,
                )
            ).scalar_one_or_none()
            if clash:
                record_issue(
                    db,
                    entity_type="driver",
                    source="fastf1",
                    source_id=external_id,
                    raw_name=full_name,
                    year=year,
                    details=f"Season code {driver_code} already belongs to driver {clash.driver_id}",
                )
                raise IdentityResolutionError(
                    f"Ambiguous {year} driver code {driver_code}: {full_name}"
                )
        season = DriverSeason(
            driver_id=driver.id,
            year=year,
            driver_code=driver_code,
            driver_number=driver_number,
            display_name=full_name,
        )
        db.add(season)
    else:
        season.driver_code = season.driver_code or driver_code
        season.driver_number = season.driver_number or driver_number
        if full_name:
            season.display_name = full_name

    if external_id and full_name and driver.full_name != full_name:
        driver.full_name = full_name
    driver.driver_code = driver_code or driver.driver_code
    driver.driver_number = driver.driver_number or driver_number
    driver.country_code = driver.country_code or country_code
    db.flush()
    return driver


def resolve_constructor(
    db,
    *,
    year: int,
    external_id: str | None,
    source_name: str,
    display_name: str,
    color: str | None,
) -> Team:
    source = "jolpica" if external_id else "lapwise-provisional"
    lookup_id = external_id or f"{year}:{slugify(source_name)}"
    constructor = db.execute(
        select(Constructor)
        .join(ConstructorExternalId)
        .where(
            ConstructorExternalId.source == source,
            ConstructorExternalId.external_id == lookup_id,
        )
    ).scalar_one_or_none()
    if constructor is None and external_id:
        provisional_id = f"{year}:{slugify(source_name)}"
        constructor = db.execute(
            select(Constructor)
            .join(ConstructorExternalId)
            .where(
                ConstructorExternalId.source == "lapwise-provisional",
                ConstructorExternalId.external_id == provisional_id,
            )
        ).scalar_one_or_none()
        if constructor is not None:
            db.add(
                ConstructorExternalId(
                    constructor_id=constructor.id,
                    source="jolpica",
                    external_id=external_id,
                )
            )
    if constructor is None:
        constructor = Constructor(
            slug=unique_slug(db, Constructor, external_id or display_name),
            canonical_name=display_name,
        )
        db.add(constructor)
        db.flush()
        db.add(
            ConstructorExternalId(
                constructor_id=constructor.id,
                source=source,
                external_id=lookup_id,
            )
        )
        if not external_id:
            record_issue(
                db,
                entity_type="constructor",
                source="fastf1",
                source_id=None,
                raw_name=source_name,
                year=year,
                details="Created provisional constructor because TeamId was absent",
            )

    team = db.execute(
        select(Team).where(Team.year == year, Team.constructor_id == constructor.id)
    ).scalar_one_or_none()
    if team is None:
        team = Team(
            year=year,
            constructor_id=constructor.id,
            name=display_name,
            source_name=source_name,
            team_color=color,
        )
        db.add(team)
    else:
        team.source_name = source_name
        team.team_color = team.team_color or color
    db.flush()
    return team


def resolve_circuit(
    db,
    *,
    year: int,
    round_num: int,
    source_name: str,
    location: str,
    country: str,
    external_id: str | None = None,
    external_aliases: list[tuple[str, str]] | None = None,
) -> Circuit:
    source = "jolpica" if external_id else "lapwise-provisional"
    lookup_id = external_id or f"{year}:{round_num}"
    venue = db.execute(
        select(CircuitVenue)
        .join(CircuitVenueExternalId)
        .where(
            CircuitVenueExternalId.source == source,
            CircuitVenueExternalId.external_id == lookup_id,
        )
    ).scalar_one_or_none()
    if venue is None and external_id:
        # A prior attempt may have created a round-scoped provisional venue
        # while Jolpica was unavailable. Promote that explicit observation;
        # never search by venue name, location, or country.
        venue = db.execute(
            select(CircuitVenue)
            .join(CircuitVenueExternalId)
            .where(
                CircuitVenueExternalId.source == "lapwise-provisional",
                CircuitVenueExternalId.external_id == f"{year}:{round_num}",
            )
        ).scalar_one_or_none()
        if venue is not None:
            db.add(
                CircuitVenueExternalId(
                    venue_id=venue.id, source="jolpica", external_id=external_id
                )
            )

    created_venue = venue is None
    if venue is None:
        venue = CircuitVenue(
            slug=unique_slug(db, CircuitVenue, external_id or source_name),
            canonical_name=source_name,
            location=location,
            country=country,
        )
        db.add(venue)
        db.flush()
        db.add(
            CircuitVenueExternalId(
                venue_id=venue.id, source=source, external_id=lookup_id
            )
        )
        if not external_id:
            record_issue(
                db,
                entity_type="circuit",
                source="fastf1",
                source_id=None,
                raw_name=source_name,
                year=year,
                round_num=round_num,
                details="Created provisional venue because Jolpica circuitId was unavailable",
            )

    for alias_source, alias_id in external_aliases or []:
        existing_alias = db.execute(
            select(CircuitVenueExternalId).where(
                CircuitVenueExternalId.source == alias_source,
                CircuitVenueExternalId.external_id == alias_id,
            )
        ).scalar_one_or_none()
        if existing_alias is not None and existing_alias.venue_id != venue.id:
            record_issue(
                db,
                entity_type="circuit",
                source=alias_source,
                source_id=alias_id,
                raw_name=source_name,
                year=year,
                round_num=round_num,
                details=(
                    f"Source ID is already mapped to venue {existing_alias.venue_id}, "
                    f"not resolved venue {venue.id}"
                ),
            )
            raise IdentityResolutionError(
                f"Conflicting {alias_source} circuit ID {alias_id}"
            )
        if existing_alias is None:
            db.add(
                CircuitVenueExternalId(
                    venue_id=venue.id,
                    source=alias_source,
                    external_id=alias_id,
                )
            )

    layout = db.execute(
        select(Circuit)
        .join(RaceSession, RaceSession.circuit_id == Circuit.id)
        .where(
            RaceSession.year == year,
            RaceSession.round == round_num,
            Circuit.venue_id == venue.id,
        )
        .limit(1)
    ).scalar_one_or_none()
    layouts = list(
        db.execute(select(Circuit).where(Circuit.venue_id == venue.id)).scalars()
    )
    if layout is None and len(layouts) == 1:
        layout = layouts[0]
    if layout is None and len(layouts) > 1:
        record_issue(
            db,
            entity_type="circuit",
            source="jolpica" if external_id else "fastf1",
            source_id=external_id,
            raw_name=source_name,
            year=year,
            round_num=round_num,
            details="Venue has multiple layouts and this round has no reviewed layout mapping",
        )
        raise IdentityResolutionError(
            f"Ambiguous circuit layout for {year} round {round_num}: {source_name}"
        )
    if layout is None:
        if not created_venue and layouts:
            raise IdentityResolutionError(
                f"Could not resolve circuit layout for {year} round {round_num}"
            )
        layout = Circuit(
            venue_id=venue.id,
            layout_slug=unique_slug(
                db,
                Circuit,
                f"{venue.slug}-{year}-{source_name}",
                column_name="layout_slug",
            ),
            source_name=source_name,
            name=source_name,
            location=location,
            country=country,
            track_length_km=None,
        )
        db.add(layout)
    db.flush()
    return layout
