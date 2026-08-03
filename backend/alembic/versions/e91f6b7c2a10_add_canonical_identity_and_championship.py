"""add canonical entity identity and championship tables

Revision ID: e91f6b7c2a10
Revises: a4c1f0b8d2e7
Create Date: 2026-08-03
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import text

from alembic import op

revision: str = "e91f6b7c2a10"
down_revision: Union[str, None] = "a4c1f0b8d2e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _slug(value: str) -> str:
    ascii_value = (
        unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    )
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-") or "unknown"


CONSTRUCTOR_KEYS = {
    "alfa romeo": "alfa",
    "andrea moda": "moda",
    "aston butterworth": "butterworth",
    "aston martin": "aston_martin",
    "brabham-alfa romeo": "brabham-alfa_romeo",
    "red bull": "red_bull",
    "red bull racing": "red_bull",
    "cadillac": "cadillac",
    "cadillac f1 team": "cadillac",
    "sauber": "sauber",
    "kick sauber": "sauber",
    "audi": "audi",
    "rb": "rb",
    "rb f1 team": "rb",
    "racing bulls": "rb",
    "alfa romeo racing": "alfa",
    "haas f1 team": "haas",
    "alpine": "alpine",
    "alpine f1 team": "alpine",
    "racing point": "racing_point",
    "force india": "force_india",
    "mercedes": "mercedes",
    "mclaren": "mclaren",
    "ferrari": "ferrari",
    "williams": "williams",
    "team lotus": "team_lotus",
    "christensen": "vhristensen",
    "cooper-alfa romeo": "cooper-alfa_romeo",
    "de tomaso": "tomaso",
    "de tomaso-alfa romeo": "de_tomaso-alfa_romeo",
    "de tomaso-osca": "de_tomaso-osca",
    "embassy hill": "hill",
    "frazer nash": "frazer_nash",
    "kurtis kraft": "kurtis_kraft",
    "lds-alfa romeo": "lds-alfa_romeo",
    "leyton house": "leyton",
    "lotus": "lotus_racing",
    "lotus f1": "lotus_f1",
    "lotus-pratt &amp; whitney": "lotus-pw",
    "manor marussia": "manor",
    "march-alfa romeo": "march-alfa_romeo",
    "mclaren-alfa romeo": "mclaren-alfa_romeo",
    "mclaren-serenissima": "mclaren-seren",
    "spyker mf1": "spyker_mf1",
    "talbot-lago": "lago",
    "iso marlboro": "iso_marlboro",
    "euro brun": "eurobrun",
    "bmw sauber": "bmw_sauber",
    "super aguri": "super_aguri",
    "toro rosso": "toro_rosso",
}


PROVISIONAL_TEAM_NAMES = {"", "none", "unknown"}


def _constructor_key(name: str, year: int) -> str:
    # Reviewed production repair: Hülkenberg's 2020 British GP FP1 result was
    # ingested under a literal "None" team instead of Racing Point.
    if year == 2020 and name.lower().strip() == "none":
        return "racing_point"
    if name.lower().strip() in PROVISIONAL_TEAM_NAMES:
        return f"provisional:{year}:{_slug(name)}"
    return CONSTRUCTOR_KEYS.get(name.lower().strip(), _slug(name))


def upgrade() -> None:
    op.create_table(
        "constructors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("canonical_name", sa.String(), nullable=False),
        sa.Column(
            "lineage_id",
            sa.Integer(),
            sa.ForeignKey("constructors.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.UniqueConstraint("slug", name="uq_constructors_slug"),
    )
    op.create_index("ix_constructors_slug", "constructors", ["slug"], unique=True)

    op.create_table(
        "circuit_venues",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("canonical_name", sa.String(), nullable=False),
        sa.Column("location", sa.String(), nullable=False),
        sa.Column("country", sa.String(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_circuit_venues_slug"),
    )
    op.create_index("ix_circuit_venues_slug", "circuit_venues", ["slug"], unique=True)

    op.add_column("drivers", sa.Column("slug", sa.String(), nullable=True))
    op.add_column("teams", sa.Column("constructor_id", sa.Integer(), nullable=True))
    op.add_column("teams", sa.Column("source_name", sa.String(), nullable=True))
    op.add_column("circuits", sa.Column("venue_id", sa.Integer(), nullable=True))
    op.add_column("circuits", sa.Column("layout_slug", sa.String(), nullable=True))
    op.add_column("circuits", sa.Column("source_name", sa.String(), nullable=True))

    op.create_foreign_key(
        "fk_teams_constructor",
        "teams",
        "constructors",
        ["constructor_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_circuits_venue",
        "circuits",
        "circuit_venues",
        ["venue_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_table(
        "driver_external_ids",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "driver_id",
            sa.Integer(),
            sa.ForeignKey("drivers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.UniqueConstraint("source", "external_id", name="uq_driver_external_id"),
    )
    op.create_index(
        "idx_driver_external_owner", "driver_external_ids", ["driver_id", "source"]
    )
    op.create_table(
        "driver_seasons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "driver_id",
            sa.Integer(),
            sa.ForeignKey("drivers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("driver_code", sa.String(length=3), nullable=True),
        sa.Column("driver_number", sa.Integer(), nullable=True),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.UniqueConstraint("year", "driver_id", name="uq_driver_season"),
    )
    op.create_index(
        "idx_driver_season_year_code",
        "driver_seasons",
        ["year", "driver_code"],
        unique=False,
    )
    op.create_index(
        "uq_driver_season_code",
        "driver_seasons",
        ["year", "driver_code"],
        unique=True,
        postgresql_where=sa.text("driver_code IS NOT NULL"),
    )
    op.create_table(
        "constructor_external_ids",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "constructor_id",
            sa.Integer(),
            sa.ForeignKey("constructors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.UniqueConstraint("source", "external_id", name="uq_constructor_external_id"),
    )
    op.create_index(
        "idx_constructor_external_owner",
        "constructor_external_ids",
        ["constructor_id", "source"],
    )
    op.create_table(
        "circuit_venue_external_ids",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "venue_id",
            sa.Integer(),
            sa.ForeignKey("circuit_venues.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.UniqueConstraint("source", "external_id", name="uq_circuit_external_id"),
    )
    op.create_index(
        "idx_circuit_external_owner",
        "circuit_venue_external_ids",
        ["venue_id", "source"],
    )
    op.create_table(
        "ingest_identity_issues",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entity_type", sa.String(length=20), nullable=False),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("source_id", sa.String(), nullable=True),
        sa.Column("raw_name", sa.String(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("round", sa.Integer(), nullable=True),
        sa.Column(
            "status", sa.String(length=20), server_default="open", nullable=False
        ),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_identity_issue_status",
        "ingest_identity_issues",
        ["status", "entity_type"],
    )

    bind = op.get_bind()

    # FastF1's original 2026 Barcelona FP1 observation omitted the names for
    # car numbers 25 and 67 and the constructor for all seven rookie entries.
    # Repair that reviewed source observation before creating canonical IDs.
    # Source: https://www.formula1.com/en/results/2026/races/1287/barcelona-catalunya/practice/1
    for code, number, full_name in (
        ("HER", 25, "Colton Herta"),
        ("FOR", 67, "Leonardo Fornaroli"),
    ):
        bind.execute(
            text(
                "UPDATE drivers SET full_name=:full_name "
                "WHERE jolpica_id IS NULL AND driver_code=:code "
                "AND driver_number=:number"
            ),
            {"full_name": full_name, "code": code, "number": number},
        )

    for code, team_name in (
        ("HER", "Cadillac"),
        ("IWA", "Red Bull Racing"),
        ("BEG", "Ferrari"),
        ("BRO", "Williams"),
        ("FOR", "McLaren"),
        ("VES", "Mercedes"),
        ("ARO", "Audi"),
    ):
        bind.execute(
            text(
                "UPDATE session_results sr SET team_id=t.id "
                "FROM sessions s, drivers d, teams t "
                "WHERE sr.session_id=s.id AND sr.driver_id=d.id "
                "AND s.year=2026 AND s.round=7 AND s.session_type='fp1' "
                "AND t.year=2026 AND t.name=:team_name "
                "AND d.driver_code=:code"
            ),
            {"team_name": team_name, "code": code},
        )
    bind.execute(
        text(
            "DELETE FROM teams t WHERE t.year=2026 AND LOWER(t.name)='unknown' "
            "AND NOT EXISTS (SELECT 1 FROM session_results sr WHERE sr.team_id=t.id)"
        )
    )

    # Stable internal driver slugs and Jolpica mappings.
    used_slugs: set[str] = set()
    for row in bind.execute(
        text("SELECT id, full_name, jolpica_id FROM drivers ORDER BY id")
    ):
        base = _slug(
            row.jolpica_id.replace("_", "-") if row.jolpica_id else row.full_name
        )
        slug = base if base not in used_slugs else f"{base}-{row.id}"
        used_slugs.add(slug)
        bind.execute(
            text("UPDATE drivers SET slug=:slug WHERE id=:id"),
            {"slug": slug, "id": row.id},
        )
        if row.jolpica_id:
            bind.execute(
                text(
                    "INSERT INTO driver_external_ids (driver_id, source, external_id) "
                    "VALUES (:id, 'jolpica', :external_id)"
                ),
                {"id": row.id, "external_id": row.jolpica_id},
            )

    # Driver abbreviations belong to a season. Correct the known reused codes here.
    season_rows = list(
        bind.execute(
            text(
                "SELECT DISTINCT d.id, d.full_name, d.driver_code, d.driver_number, "
                "d.jolpica_id, s.year FROM drivers d "
                "JOIN session_results sr ON sr.driver_id=d.id "
                "JOIN sessions s ON s.id=sr.session_id ORDER BY s.year, d.id"
            )
        )
    )
    provisional_counts: dict[tuple[int, str], int] = defaultdict(int)
    for row in season_rows:
        if not row.jolpica_id:
            provisional_counts[(row.year, _slug(row.full_name))] += 1
    corrected_codes = {
        "magnussen": "MAG",
        "kevin_magnussen": "MAG",
        "michael_schumacher": "MSC",
        "mick_schumacher": "MSC",
    }
    for row in season_rows:
        code = corrected_codes.get(row.jolpica_id, row.driver_code)
        bind.execute(
            text(
                "INSERT INTO driver_seasons "
                "(driver_id, year, driver_code, driver_number, display_name) "
                "VALUES (:driver_id, :year, :code, :number, :name)"
            ),
            {
                "driver_id": row.id,
                "year": row.year,
                "code": code,
                "number": row.driver_number,
                "name": row.full_name,
            },
        )
        if not row.jolpica_id:
            provisional_id = f"{row.year}:{_slug(row.full_name)}"
            if provisional_counts[(row.year, _slug(row.full_name))] == 1:
                bind.execute(
                    text(
                        "INSERT INTO driver_external_ids "
                        "(driver_id, source, external_id) "
                        "VALUES (:driver_id, 'lapwise-provisional', :external_id)"
                    ),
                    {"driver_id": row.id, "external_id": provisional_id},
                )
            else:
                bind.execute(
                    text(
                        "INSERT INTO ingest_identity_issues "
                        "(entity_type, source, raw_name, year, details) "
                        "VALUES ('driver', 'legacy', :name, :year, "
                        "'Existing driver has no stable source ID and its raw name is ambiguous')"
                    ),
                    {"name": row.full_name, "year": row.year},
                )

    # Constructor master rows. Names are only used for this reviewed one-time migration;
    # normal ingestion resolves through constructor_external_ids.
    constructor_by_key: dict[str, int] = {}
    constructor_names: dict[str, tuple[str, int]] = {}
    for row in bind.execute(text("SELECT id, year, name FROM teams ORDER BY year, id")):
        key = _constructor_key(row.name, row.year)
        constructor_names.setdefault(key, (row.name, row.year))
    for key, (name, year) in constructor_names.items():
        slug = _slug(key.replace("_", "-"))
        constructor_id = bind.execute(
            text(
                "INSERT INTO constructors (slug, canonical_name) VALUES (:slug, :name) "
                "RETURNING id"
            ),
            {"slug": slug, "name": name},
        ).scalar_one()
        constructor_by_key[key] = constructor_id
        provisional = key.startswith("provisional:")
        bind.execute(
            text(
                "INSERT INTO constructor_external_ids "
                "(constructor_id, source, external_id) VALUES (:id, :source, :key)"
            ),
            {
                "id": constructor_id,
                "source": "lapwise-provisional" if provisional else "jolpica",
                "key": f"{year}:{_slug(name)}" if provisional else key,
            },
        )
        if provisional:
            bind.execute(
                text(
                    "INSERT INTO ingest_identity_issues "
                    "(entity_type, source, raw_name, year, details) "
                    "VALUES ('constructor', 'legacy', :name, :year, "
                    "'Existing team has no stable constructor source ID')"
                ),
                {"name": name, "year": year},
            )
    for row in bind.execute(text("SELECT id, year, name FROM teams ORDER BY id")):
        bind.execute(
            text(
                "UPDATE teams SET constructor_id=:constructor_id, source_name=name "
                "WHERE id=:id"
            ),
            {
                "constructor_id": constructor_by_key[
                    _constructor_key(row.name, row.year)
                ],
                "id": row.id,
            },
        )

    # Explicit legacy-name aliases preserve old routes without making names an
    # ingestion identity key. Ambiguous names are deliberately omitted.
    bind.execute(
        text(
            "INSERT INTO constructor_external_ids (constructor_id, source, external_id) "
            "SELECT MIN(constructor_id), 'legacy-name', LOWER(name) FROM teams "
            "GROUP BY LOWER(name) HAVING COUNT(DISTINCT constructor_id)=1 "
            "ON CONFLICT (source, external_id) DO NOTHING"
        )
    )

    # Merge duplicate season entries that now resolve to the same constructor.
    grouped: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)
    for row in bind.execute(
        text(
            "SELECT t.id, t.year, t.constructor_id, COUNT(sr.id) AS n FROM teams t "
            "LEFT JOIN session_results sr ON sr.team_id=t.id "
            "GROUP BY t.id ORDER BY t.id"
        )
    ):
        grouped[(row.year, row.constructor_id)].append((row.id, row.n))
    for entries in grouped.values():
        if len(entries) < 2:
            continue
        keeper = max(entries, key=lambda item: (item[1], -item[0]))[0]
        for duplicate, _ in entries:
            if duplicate == keeper:
                continue
            bind.execute(
                text(
                    "UPDATE session_results SET team_id=:keeper WHERE team_id=:duplicate"
                ),
                {"keeper": keeper, "duplicate": duplicate},
            )
            bind.execute(text("DELETE FROM teams WHERE id=:id"), {"id": duplicate})

    # Venue parents; Nürburg/Nürburgring are one venue with distinct layouts.
    venue_by_key: dict[str, int] = {}
    circuits = list(
        bind.execute(
            text("SELECT id, name, location, country FROM circuits ORDER BY id")
        )
    )
    for row in circuits:
        key = (
            "nurburgring"
            if _slug(row.name) in {"nurburgring", "nurburg"}
            or _slug(row.location) in {"nurburgring", "nurburg"}
            else _slug(row.name)
        )
        if key not in venue_by_key:
            venue_by_key[key] = bind.execute(
                text(
                    "INSERT INTO circuit_venues "
                    "(slug, canonical_name, location, country) "
                    "VALUES (:slug, :name, :location, :country) RETURNING id"
                ),
                {
                    "slug": key,
                    "name": "Nürburgring" if key == "nurburgring" else row.name,
                    "location": row.location,
                    "country": row.country,
                },
            ).scalar_one()
        layout = f"{key}-{row.id}"
        if key == "nurburgring":
            layout = (
                "nurburgring-2020"
                if row.name == "Nürburgring"
                else "nurburgring-historic"
            )
        bind.execute(
            text(
                "UPDATE circuits SET venue_id=:venue_id, layout_slug=:layout, "
                "source_name=name WHERE id=:id"
            ),
            {"venue_id": venue_by_key[key], "layout": layout, "id": row.id},
        )

    # Existing Indianapolis data used one row for two genuinely different
    # layouts. Keep the modern road course on the legacy ID (and favorites),
    # then move 1950-1960 Indianapolis 500 sessions to an oval layout row.
    indianapolis = bind.execute(
        text(
            "SELECT id, venue_id, name, location, country, track_length_km, "
            "latitude, longitude FROM circuits "
            "WHERE LOWER(name)='indianapolis' OR LOWER(location)='indianapolis' "
            "ORDER BY id LIMIT 1"
        )
    ).first()
    if indianapolis:
        bind.execute(
            text(
                "SELECT setval(pg_get_serial_sequence('circuits', 'id'), "
                "GREATEST((SELECT MAX(id) FROM circuits), 1), true)"
            )
        )
        bind.execute(
            text("UPDATE circuits SET layout_slug='indianapolis-f1-road' WHERE id=:id"),
            {"id": indianapolis.id},
        )
        oval_id = bind.execute(
            text(
                "INSERT INTO circuits (venue_id, layout_slug, source_name, name, "
                "location, country, track_length_km, latitude, longitude) "
                "VALUES (:venue_id, 'indianapolis-oval', 'Indianapolis 500', "
                "'Indianapolis Motor Speedway Oval', :location, :country, 4.023, "
                ":latitude, :longitude) RETURNING id"
            ),
            {
                "venue_id": indianapolis.venue_id,
                "location": indianapolis.location,
                "country": indianapolis.country,
                "latitude": indianapolis.latitude,
                "longitude": indianapolis.longitude,
            },
        ).scalar_one()
        bind.execute(
            text(
                "UPDATE sessions SET circuit_id=:oval_id "
                "WHERE circuit_id=:road_id AND year BETWEEN 1950 AND 1960"
            ),
            {"oval_id": oval_id, "road_id": indianapolis.id},
        )

    op.alter_column("drivers", "slug", nullable=False)
    op.create_index("ix_drivers_slug", "drivers", ["slug"], unique=True)
    op.drop_constraint("drivers_driver_code_key", "drivers", type_="unique")
    bind.execute(
        text(
            "UPDATE drivers SET driver_code=CASE jolpica_id "
            "WHEN 'kevin_magnussen' THEN 'MAG' "
            "WHEN 'mick_schumacher' THEN 'MSC' ELSE driver_code END"
        )
    )
    op.create_index("ix_drivers_driver_code", "drivers", ["driver_code"], unique=False)

    op.drop_constraint("uq_team_year_name", "teams", type_="unique")
    op.alter_column("teams", "constructor_id", nullable=False)
    op.create_unique_constraint(
        "uq_team_year_constructor", "teams", ["year", "constructor_id"]
    )
    op.alter_column("circuits", "venue_id", nullable=False)
    op.alter_column("circuits", "layout_slug", nullable=False)
    op.create_index("ix_circuits_layout_slug", "circuits", ["layout_slug"], unique=True)

    _create_championship_tables()
    _seed_scoring_contexts(bind)
    _seed_classification_exceptions(bind)
    _replace_clutch_views()
    bind.execute(
        text(
            "DELETE FROM ai_response_cache WHERE "
            "queries_json::text ILIKE '%v_driver_standings%' OR "
            "queries_json::text ILIKE '%v_constructor_standings%' OR "
            "response_text ~* '(champion|championship|standings)'"
        )
    )


def _create_championship_tables() -> None:
    op.create_table(
        "driver_championship_standings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column(
            "driver_id",
            sa.Integer(),
            sa.ForeignKey("drivers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("championship_points", sa.Numeric(10, 3), nullable=False),
        sa.Column("wins", sa.Integer(), server_default="0", nullable=False),
        sa.Column("source_round", sa.Integer(), nullable=False),
        sa.Column("is_final", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.Column(
            "ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.UniqueConstraint("year", "driver_id", name="uq_driver_championship_year"),
        sa.UniqueConstraint("year", "position", name="uq_driver_championship_position"),
    )
    op.create_index(
        "idx_driver_championship_driver",
        "driver_championship_standings",
        ["driver_id", "year"],
    )
    op.create_table(
        "constructor_championship_standings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column(
            "team_id",
            sa.Integer(),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("championship_points", sa.Numeric(10, 3), nullable=False),
        sa.Column("wins", sa.Integer(), server_default="0", nullable=False),
        sa.Column("source_round", sa.Integer(), nullable=False),
        sa.Column("is_final", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.Column(
            "ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.UniqueConstraint("year", "team_id", name="uq_constructor_championship_year"),
        sa.UniqueConstraint(
            "year", "position", name="uq_constructor_championship_position"
        ),
    )
    op.create_index(
        "idx_constructor_championship_team",
        "constructor_championship_standings",
        ["team_id", "year"],
    )
    op.create_table(
        "championship_scoring_contexts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("entrant_type", sa.String(length=20), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("short_label", sa.String(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column(
            "comparison_mode",
            sa.String(length=20),
            server_default="comparison",
            nullable=False,
        ),
        sa.UniqueConstraint("year", "entrant_type", name="uq_championship_context"),
        sa.CheckConstraint(
            "entrant_type IN ('driver', 'constructor')",
            name="ck_championship_context_type",
        ),
    )
    op.create_table(
        "championship_classification_exceptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("entrant_type", sa.String(length=20), nullable=False),
        sa.Column(
            "driver_id",
            sa.Integer(),
            sa.ForeignKey("drivers.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "team_id",
            sa.Integer(),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("points_scored", sa.Numeric(10, 3), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.UniqueConstraint(
            "year", "entrant_type", "driver_id", "team_id", name="uq_champ_exception"
        ),
        sa.CheckConstraint(
            "(entrant_type = 'driver' AND driver_id IS NOT NULL AND team_id IS NULL) OR (entrant_type = 'constructor' AND team_id IS NOT NULL AND driver_id IS NULL)",
            name="ck_champ_exception_entity",
        ),
    )
    op.create_index(
        "idx_champ_exception_year",
        "championship_classification_exceptions",
        ["year", "entrant_type"],
    )
    op.create_index(
        "uq_driver_champ_exception",
        "championship_classification_exceptions",
        ["year", "driver_id"],
        unique=True,
        postgresql_where=sa.text("entrant_type = 'driver'"),
    )
    op.create_index(
        "uq_constructor_champ_exception",
        "championship_classification_exceptions",
        ["year", "team_id"],
        unique=True,
        postgresql_where=sa.text("entrant_type = 'constructor'"),
    )


def _seed_scoring_contexts(bind) -> None:
    driver_rules = {
        1950: (
            "shared_drive",
            "Dropped scores and shared drives",
            "Championship points reflect historical dropped-score and shared-drive attribution rules.",
            "note_only",
        ),
        1951: (
            "dropped_scores",
            "Best 4 of 8 results",
            "Only the driver's best 4 results counted toward the championship.",
            "comparison",
        ),
        1952: (
            "dropped_scores",
            "Best 4 of 8 results",
            "Only the driver's best 4 results counted toward the championship.",
            "comparison",
        ),
        1953: (
            "dropped_scores",
            "Best 4 of 9 results",
            "Only the driver's best 4 results counted toward the championship.",
            "comparison",
        ),
        1954: (
            "shared_drive",
            "Dropped scores and shared drives",
            "Championship points reflect historical dropped-score and shared-drive attribution rules.",
            "note_only",
        ),
        1955: (
            "dropped_scores",
            "Best 5 of 7 results",
            "Only the driver's best 5 results counted toward the championship.",
            "comparison",
        ),
        1956: (
            "dropped_scores",
            "Best 5 of 8 results",
            "Only the driver's best 5 results counted toward the championship.",
            "comparison",
        ),
        1957: (
            "dropped_scores",
            "Best 5 of 8 results",
            "Only the driver's best 5 results counted toward the championship.",
            "comparison",
        ),
        1958: (
            "dropped_scores",
            "Best 6 of 11 results",
            "Only the driver's best 6 results counted toward the championship.",
            "comparison",
        ),
        1959: (
            "dropped_scores",
            "Best 5 of 9 results",
            "Only the driver's best 5 results counted toward the championship.",
            "comparison",
        ),
        1960: (
            "dropped_scores",
            "Best 6 of 10 results",
            "Only the driver's best 6 results counted toward the championship.",
            "comparison",
        ),
        1961: (
            "dropped_scores",
            "Best 5 of 8 results",
            "Only the driver's best 5 results counted toward the championship.",
            "comparison",
        ),
        1962: (
            "dropped_scores",
            "Best 5 of 9 results",
            "Only the driver's best 5 results counted toward the championship.",
            "comparison",
        ),
        1963: (
            "dropped_scores",
            "Best 6 of 10 results",
            "Only the driver's best 6 results counted toward the championship.",
            "comparison",
        ),
        1964: (
            "dropped_scores",
            "Best 6 of 10 results",
            "Only the driver's best 6 results counted toward the championship.",
            "comparison",
        ),
        1965: (
            "dropped_scores",
            "Best 6 of 10 results",
            "Only the driver's best 6 results counted toward the championship.",
            "comparison",
        ),
        1966: (
            "dropped_scores",
            "Best 5 of 9 results",
            "Only the driver's best 5 results counted toward the championship.",
            "comparison",
        ),
        1976: (
            "dropped_scores",
            "Dropped-score rules applied",
            "Only a limited number of results from each part of the season counted; the exact race selection is not shown.",
            "note_only",
        ),
        1977: (
            "dropped_scores",
            "Dropped-score rules applied",
            "Only a limited number of results from each part of the season counted; the exact race selection is not shown.",
            "note_only",
        ),
        1979: (
            "dropped_scores",
            "Best results from each half",
            "Only the best 4 results from each part of the season counted.",
            "comparison",
        ),
        1980: (
            "dropped_scores",
            "Best results from each half",
            "Only the best 4 results from rounds 1–7 and best 5 from rounds 8–14 counted.",
            "comparison",
        ),
        1985: (
            "dropped_scores",
            "Best 11 of 16 results",
            "Only the driver's best 11 results counted toward the championship.",
            "comparison",
        ),
        1986: (
            "dropped_scores",
            "Best 11 of 16 results",
            "Only the driver's best 11 results counted toward the championship.",
            "comparison",
        ),
        1987: (
            "dropped_scores",
            "Best 11 of 16 results",
            "Only the driver's best 11 results counted toward the championship.",
            "comparison",
        ),
        1988: (
            "dropped_scores",
            "Best 11 of 16 results",
            "Only the driver's best 11 results counted toward the championship.",
            "comparison",
        ),
        1989: (
            "dropped_scores",
            "Best 11 of 16 results",
            "Only the driver's best 11 results counted toward the championship.",
            "comparison",
        ),
        1990: (
            "dropped_scores",
            "Best 11 of 16 results",
            "Only the driver's best 11 results counted toward the championship.",
            "comparison",
        ),
    }
    for year, (kind, label, explanation, mode) in driver_rules.items():
        bind.execute(
            text(
                "INSERT INTO championship_scoring_contexts (year, entrant_type, kind, short_label, explanation, comparison_mode) VALUES (:year, 'driver', :kind, :label, :explanation, :mode)"
            ),
            {
                "year": year,
                "kind": kind,
                "label": label,
                "explanation": explanation,
                "mode": mode,
            },
        )
    for year in range(1950, 1958):
        bind.execute(
            text(
                "INSERT INTO championship_scoring_contexts "
                "(year, entrant_type, kind, short_label, explanation, comparison_mode) "
                "VALUES (:year, 'constructor', 'not_held', 'No constructors championship', "
                "'The Formula One Constructors Championship was introduced in 1958.', 'note_only')"
            ),
            {"year": year},
        )
    for year in range(1958, 1979):
        bind.execute(
            text(
                "INSERT INTO championship_scoring_contexts (year, entrant_type, kind, short_label, explanation, comparison_mode) VALUES (:year, 'constructor', 'best_car_only', 'Best-placed car only', 'Only each constructor''s best-placed car scored championship points at each race.', 'comparison')"
            ),
            {"year": year},
        )
    bind.execute(
        text(
            "INSERT INTO championship_scoring_contexts (year, entrant_type, kind, short_label, explanation, comparison_mode) VALUES (2007, 'constructor', 'exclusion', 'McLaren excluded', 'McLaren was excluded from the 2007 Constructors'' Championship and its constructor points were annulled.', 'note_only')"
        )
    )


def _seed_classification_exceptions(bind) -> None:
    mclaren_team_id = bind.execute(
        text(
            "SELECT t.id FROM teams t JOIN constructors c ON c.id=t.constructor_id "
            "WHERE t.year=2007 AND c.slug='mclaren' LIMIT 1"
        )
    ).scalar_one_or_none()
    if mclaren_team_id is None:
        return
    points_scored = bind.execute(
        text(
            "SELECT COALESCE(SUM(sr.points), 0) FROM session_results sr "
            "JOIN sessions s ON s.id=sr.session_id "
            "WHERE sr.team_id=:team_id AND s.year=2007 "
            "AND s.session_type IN ('race', 'sprint_race')"
        ),
        {"team_id": mclaren_team_id},
    ).scalar_one()
    bind.execute(
        text(
            "INSERT INTO championship_classification_exceptions "
            "(year, entrant_type, team_id, status, points_scored, explanation, source_url) "
            "VALUES (2007, 'constructor', :team_id, 'excluded', :points, "
            "'McLaren was excluded from the 2007 Constructors Championship and its constructor points were annulled.', "
            "'https://www.racefans.net/2007/09/14/fia-verdict-on-mclaren-full-text/')"
        ),
        {"team_id": mclaren_team_id, "points": points_scored},
    )


def _replace_clutch_views() -> None:
    op.execute(
        """
        CREATE OR REPLACE VIEW v_driver_standings AS
        WITH raw AS (
            SELECT s.year, sr.driver_id, COALESCE(SUM(sr.points), 0) AS points_scored,
                   COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position=1) AS wins,
                   COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position<=3) AS podiums,
                   COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position IS NOT NULL) AS finishes,
                   COUNT(*) FILTER (WHERE s.session_type='race') AS races_entered
            FROM session_results sr JOIN sessions s ON s.id=sr.session_id
            WHERE s.session_type IN ('race', 'sprint_race') GROUP BY s.year, sr.driver_id
        ), latest_team AS (
            SELECT DISTINCT ON (s.year, sr.driver_id) s.year, sr.driver_id, t.name
            FROM session_results sr JOIN sessions s ON s.id=sr.session_id
            JOIN teams t ON t.id=sr.team_id WHERE s.session_type='race'
            ORDER BY s.year, sr.driver_id, s.round DESC
        )
        SELECT r.year,
               CASE WHEN ex.id IS NOT NULL THEN NULL
                    WHEN cs.id IS NOT NULL THEN cs.position
                    WHEN r.year >= EXTRACT(YEAR FROM CURRENT_DATE) THEN
                      RANK() OVER (PARTITION BY r.year ORDER BY r.points_scored DESC, r.wins DESC)::integer
                    ELSE NULL END AS championship_position,
               d.full_name AS driver_name, COALESCE(ds.driver_code, d.driver_code) AS driver_code,
               d.country_code, lt.name AS team_name,
               CASE WHEN ex.id IS NOT NULL THEN NULL
                    WHEN cs.id IS NOT NULL THEN cs.championship_points
                    WHEN r.year >= EXTRACT(YEAR FROM CURRENT_DATE) THEN r.points_scored
                    ELSE NULL END AS points,
               r.wins, r.podiums, r.finishes, r.races_entered,
               d.slug AS driver_slug, cs.championship_points, r.points_scored,
               COALESCE(ex.status, CASE WHEN cs.is_final THEN 'classified'
                    WHEN cs.id IS NOT NULL OR r.year >= EXTRACT(YEAR FROM CURRENT_DATE) THEN 'provisional'
                    ELSE 'not_classified' END) AS classification_status,
               COALESCE(ex.explanation,
                    CASE WHEN cs.championship_points IS DISTINCT FROM r.points_scored THEN ctx.explanation END) AS explanation,
               CASE WHEN cs.id IS NOT NULL THEN 'official'
                    WHEN r.year >= EXTRACT(YEAR FROM CURRENT_DATE) THEN 'computed_provisional'
                    ELSE 'missing_official' END AS standings_source,
               COALESCE(ex.source_url, cs.source_url) AS explanation_source_url
        FROM raw r JOIN drivers d ON d.id=r.driver_id
        LEFT JOIN driver_seasons ds ON ds.driver_id=r.driver_id AND ds.year=r.year
        LEFT JOIN latest_team lt ON lt.driver_id=r.driver_id AND lt.year=r.year
        LEFT JOIN driver_championship_standings cs ON cs.driver_id=r.driver_id AND cs.year=r.year
        LEFT JOIN championship_classification_exceptions ex
          ON ex.driver_id=r.driver_id AND ex.year=r.year AND ex.entrant_type='driver'
        LEFT JOIN championship_scoring_contexts ctx ON ctx.year=r.year AND ctx.entrant_type='driver'
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW v_constructor_standings AS
        WITH raw AS (
            SELECT s.year, t.id AS team_id, COALESCE(SUM(sr.points), 0) AS points_scored,
                   COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position=1) AS wins,
                   COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position<=3) AS podiums,
                   COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position IS NOT NULL) AS finishes
            FROM session_results sr JOIN sessions s ON s.id=sr.session_id
            JOIN teams t ON t.id=sr.team_id
            WHERE s.session_type IN ('race', 'sprint_race') GROUP BY s.year, t.id
        )
        SELECT r.year,
               CASE WHEN ex.id IS NOT NULL THEN NULL
                    WHEN cs.id IS NOT NULL THEN cs.position
                    WHEN r.year >= EXTRACT(YEAR FROM CURRENT_DATE) THEN
                      RANK() OVER (PARTITION BY r.year ORDER BY r.points_scored DESC)::integer
                    ELSE NULL END AS championship_position,
               t.name AS team_name, t.team_color,
               CASE WHEN ex.id IS NOT NULL THEN NULL
                    WHEN cs.id IS NOT NULL THEN cs.championship_points
                    WHEN r.year >= EXTRACT(YEAR FROM CURRENT_DATE) THEN r.points_scored
                    ELSE NULL END AS points,
               r.wins, r.podiums, r.finishes,
               c.slug AS constructor_slug, cs.championship_points,
               COALESCE(ex.points_scored, r.points_scored) AS points_scored,
               COALESCE(ex.status, CASE WHEN cs.is_final THEN 'classified'
                    WHEN cs.id IS NOT NULL OR r.year >= EXTRACT(YEAR FROM CURRENT_DATE) THEN 'provisional'
                    ELSE 'not_classified' END) AS classification_status,
               COALESCE(ex.explanation,
                    CASE WHEN cs.championship_points IS DISTINCT FROM r.points_scored THEN ctx.explanation END) AS explanation,
               CASE WHEN ex.id IS NOT NULL OR cs.id IS NOT NULL THEN 'official'
                    WHEN r.year >= EXTRACT(YEAR FROM CURRENT_DATE) THEN 'computed_provisional'
                    ELSE 'missing_official' END AS standings_source,
               COALESCE(ex.source_url, cs.source_url) AS explanation_source_url
        FROM raw r JOIN teams t ON t.id=r.team_id JOIN constructors c ON c.id=t.constructor_id
        LEFT JOIN constructor_championship_standings cs ON cs.team_id=r.team_id AND cs.year=r.year
        LEFT JOIN championship_classification_exceptions ex
          ON ex.team_id=r.team_id AND ex.year=r.year AND ex.entrant_type='constructor'
        LEFT JOIN championship_scoring_contexts ctx ON ctx.year=r.year AND ctx.entrant_type='constructor'
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_constructor_standings")
    op.execute("DROP VIEW IF EXISTS v_driver_standings")
    op.execute(
        "UPDATE sessions SET circuit_id=(SELECT id FROM circuits WHERE layout_slug='indianapolis-f1-road' LIMIT 1) "
        "WHERE circuit_id=(SELECT id FROM circuits WHERE layout_slug='indianapolis-oval' LIMIT 1)"
    )
    op.execute("DELETE FROM circuits WHERE layout_slug='indianapolis-oval'")
    op.drop_table("championship_classification_exceptions")
    op.drop_table("championship_scoring_contexts")
    op.drop_table("constructor_championship_standings")
    op.drop_table("driver_championship_standings")
    op.drop_index("ix_circuits_layout_slug", table_name="circuits")
    op.drop_constraint("uq_team_year_constructor", "teams", type_="unique")
    op.create_unique_constraint("uq_team_year_name", "teams", ["year", "name"])
    op.drop_index("ix_drivers_driver_code", table_name="drivers")
    op.execute(
        "UPDATE drivers SET driver_code=NULL WHERE jolpica_id IN "
        "('kevin_magnussen', 'mick_schumacher')"
    )
    op.create_unique_constraint("drivers_driver_code_key", "drivers", ["driver_code"])
    op.drop_index("ix_drivers_slug", table_name="drivers")
    op.drop_table("ingest_identity_issues")
    op.drop_table("circuit_venue_external_ids")
    op.drop_table("constructor_external_ids")
    op.drop_index("uq_driver_season_code", table_name="driver_seasons")
    op.drop_index("idx_driver_season_year_code", table_name="driver_seasons")
    op.drop_table("driver_seasons")
    op.drop_table("driver_external_ids")
    op.drop_constraint("fk_circuits_venue", "circuits", type_="foreignkey")
    op.drop_constraint("fk_teams_constructor", "teams", type_="foreignkey")
    op.drop_column("circuits", "source_name")
    op.drop_column("circuits", "layout_slug")
    op.drop_column("circuits", "venue_id")
    op.drop_column("teams", "source_name")
    op.drop_column("teams", "constructor_id")
    op.drop_column("drivers", "slug")
    op.drop_table("circuit_venues")
    op.drop_table("constructors")
    _restore_raw_clutch_views()


def _restore_raw_clutch_views() -> None:
    op.execute(
        """
        CREATE VIEW v_driver_standings AS
        WITH latest_team AS (
          SELECT DISTINCT ON (s.year, sr.driver_id) s.year, sr.driver_id, t.name
          FROM session_results sr JOIN sessions s ON s.id=sr.session_id
          JOIN teams t ON t.id=sr.team_id WHERE s.session_type='race'
          ORDER BY s.year, sr.driver_id, s.round DESC
        ), raw AS (
          SELECT s.year, sr.driver_id, COALESCE(SUM(sr.points),0) AS points,
            COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position=1) AS wins,
            COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position<=3) AS podiums,
            COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position IS NOT NULL) AS finishes,
            COUNT(*) FILTER (WHERE s.session_type='race') AS races_entered
          FROM session_results sr JOIN sessions s ON s.id=sr.session_id
          WHERE s.session_type IN ('race','sprint_race') GROUP BY s.year,sr.driver_id
        )
        SELECT r.year, RANK() OVER (PARTITION BY r.year ORDER BY r.points DESC,r.wins DESC)::integer AS championship_position,
          d.full_name AS driver_name,d.driver_code,d.country_code,lt.name AS team_name,
          r.points,r.wins,r.podiums,r.finishes,r.races_entered
        FROM raw r JOIN drivers d ON d.id=r.driver_id
        LEFT JOIN latest_team lt ON lt.year=r.year AND lt.driver_id=r.driver_id
        """
    )
    op.execute(
        """
        CREATE VIEW v_constructor_standings AS
        SELECT s.year,RANK() OVER (PARTITION BY s.year ORDER BY SUM(sr.points) DESC)::integer AS championship_position,
          t.name AS team_name,t.team_color,COALESCE(SUM(sr.points),0) AS points,
          COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position=1) AS wins,
          COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position<=3) AS podiums,
          COUNT(*) FILTER (WHERE s.session_type='race' AND sr.position IS NOT NULL) AS finishes
        FROM session_results sr JOIN sessions s ON s.id=sr.session_id
        JOIN teams t ON t.id=sr.team_id WHERE s.session_type IN ('race','sprint_race')
        GROUP BY s.year,t.id,t.name,t.team_color
        """
    )
